"""
AI Screening Worker
Consumes jobs from Redis queue:screening, scores video proof, reports back to Go API.

Production scorer: extracts a frame via ffmpeg and scores it with Gemini vision.
Falls back to a deterministic FNV-1a stub if Gemini is unavailable or any error occurs.
"""

import asyncio
import base64
import json
import logging
import os
import signal
import sys
from contextlib import suppress

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI, Response
from pydantic import BaseModel

try:
    import google.generativeai as genai
except ImportError:
    genai = None


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
    stream=sys.stdout,
)
log = logging.getLogger("ai-screener")


app = FastAPI(title="dare-ai-screener")

REDIS_URL       = os.getenv("REDIS_URL", "redis://localhost:6379")
API_URL         = os.getenv("API_INTERNAL_URL", "http://localhost:8080")
R2_PUBLIC_URL   = os.getenv("R2_PUBLIC_URL", "").rstrip("/")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL    = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
CONCURRENCY     = int(os.getenv("SCREENER_CONCURRENCY", "3"))
QUEUE_KEY       = "queue:screening"
STUB_DEFER_CONFIDENCE = 0.50  # sub-threshold: stub/error verdicts defer to the crowd, never auto-verify
REPORT_MAX_ATTEMPTS   = 4      # callback retries before giving up (a lost callback leaves a drop stuck 'pending')
INTERNAL_API_SECRET   = os.getenv("INTERNAL_API_SECRET", "")  # shared secret for the API /internal callback

GEMINI_PROMPT_TMPL = (
    "You are verifying a dare challenge video frame. The dare is: "
    "'{dareTitle}' (category: '{category}'). Does this image show genuine "
    "attempt at completing the dare? Reply with JSON only: "
    "{{\"pass\": true/false, \"confidence\": 0.0-1.0, \"reason\": \"one sentence\"}}"
)


class ScreeningJob(BaseModel):
    dropId:    int
    dareTitle: str
    category:  str
    r2Key:     str | None = None
    proofUrl:  str | None = None


class ScreeningResult(BaseModel):
    dropId:     int
    pass_:      bool
    confidence: float
    reason:     str


# ---- Module state -----------------------------------------------------------

_state: dict = {
    "rdb": None,
    "http": None,
    "semaphore": None,
    "gemini_model": None,
    "shutdown": False,
    "in_flight": 0,
    "in_flight_cv": None,
    "consumer_task": None,
}


# ---- Lifecycle --------------------------------------------------------------

@app.on_event("startup")
async def startup():
    _state["rdb"]   = aioredis.from_url(REDIS_URL)
    _state["http"]  = httpx.AsyncClient()
    _state["semaphore"]   = asyncio.Semaphore(CONCURRENCY)
    _state["in_flight_cv"] = asyncio.Condition()

    if genai and GEMINI_API_KEY:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            _state["gemini_model"] = genai.GenerativeModel(GEMINI_MODEL)
            log.info("gemini configured model=%s", GEMINI_MODEL)
        except Exception as e:
            log.warning("gemini init failed, falling back to stub: %s", e)
    else:
        log.warning("GEMINI_API_KEY unset or SDK missing — using stub scorer")

    _state["consumer_task"] = asyncio.create_task(consume_queue())
    _install_signal_handlers()
    log.info("worker started concurrency=%d", CONCURRENCY)


@app.on_event("shutdown")
async def shutdown():
    await _graceful_drain()
    if _state["http"]:
        await _state["http"].aclose()
    if _state["rdb"]:
        await _state["rdb"].close()
    log.info("worker shutdown complete")


def _install_signal_handlers():
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        with suppress(NotImplementedError):
            loop.add_signal_handler(sig, lambda s=sig: asyncio.create_task(_request_shutdown(s)))


async def _request_shutdown(sig):
    log.info("received signal=%s, beginning drain", sig.name if hasattr(sig, "name") else sig)
    _state["shutdown"] = True


async def _graceful_drain():
    _state["shutdown"] = True
    task = _state["consumer_task"]
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    cv = _state["in_flight_cv"]
    if cv:
        async with cv:
            while _state["in_flight"] > 0:
                log.info("draining in_flight=%d", _state["in_flight"])
                await cv.wait()
    log.info("drain complete")


# ---- Queue consumer ---------------------------------------------------------

async def consume_queue():
    rdb = _state["rdb"]
    while not _state["shutdown"]:
        try:
            popped = await rdb.blpop(QUEUE_KEY, timeout=5)
            if not popped:
                continue
            _, raw = popped
            try:
                job = ScreeningJob(**json.loads(raw))
            except Exception as e:
                log.error("malformed job dropped: %s", e)
                continue
            asyncio.create_task(_handle_job(job))
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.error("consumer error: %s", e)
            await asyncio.sleep(1)


async def _handle_job(job: ScreeningJob):
    async with _state["in_flight_cv"]:
        _state["in_flight"] += 1
    try:
        result = await screen(job)
        await report_result(_state["http"], result)
    finally:
        async with _state["in_flight_cv"]:
            _state["in_flight"] -= 1
            _state["in_flight_cv"].notify_all()


# ---- Scoring ----------------------------------------------------------------

async def screen(job: ScreeningJob) -> ScreeningResult:
    """
    Real Gemini-backed scorer with stub fallback. Must never crash.
    """
    log.info("screen start drop=%d title=%r category=%r", job.dropId, job.dareTitle, job.category)
    try:
        video_url = _resolve_video_url(job)

        if _state["gemini_model"] and video_url:
            async with _state["semaphore"]:
                frame_bytes = await _extract_frame(video_url)
            if frame_bytes:
                parsed = await _score_with_gemini(frame_bytes, job)
                if parsed is not None:
                    pass_, confidence, reason = parsed
                    log.info("screen ok drop=%d pass=%s conf=%.2f", job.dropId, pass_, confidence)
                    return ScreeningResult(
                        dropId=job.dropId,
                        pass_=pass_,
                        confidence=confidence,
                        reason=reason,
                    )
                log.warning("gemini non-json drop=%d — falling back", job.dropId)
            else:
                log.warning("frame extract failed drop=%d — falling back", job.dropId)
        # fall through to stub
        return _stub_score(job)
    except Exception as e:
        log.exception("screen crashed drop=%d: %s", job.dropId, e)
        # On error, never auto-verify — defer to the crowd with a sub-threshold score.
        return ScreeningResult(
            dropId=job.dropId,
            pass_=False,
            confidence=STUB_DEFER_CONFIDENCE,
            reason="screener_error — routed to crowd",
        )


def _resolve_video_url(job: ScreeningJob) -> str | None:
    if job.r2Key and R2_PUBLIC_URL:
        return f"{R2_PUBLIC_URL}/{job.r2Key}"
    if job.proofUrl and job.proofUrl.startswith(("http://", "https://")):
        return job.proofUrl
    return None


async def _extract_frame(video_url: str) -> bytes | None:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-ss", "2", "-i", video_url,
            "-vframes", "1", "-f", "image2", "-q:v", "2", "pipe:1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        log.warning("ffmpeg not installed")
        return None
    except Exception as e:
        log.warning("ffmpeg spawn failed: %s", e)
        return None

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
    except asyncio.TimeoutError:
        with suppress(ProcessLookupError):
            proc.kill()
        log.warning("ffmpeg timeout url=%s", video_url)
        return None

    if proc.returncode != 0:
        log.warning("ffmpeg rc=%d err=%s", proc.returncode, stderr.decode("utf-8", "replace")[:200])
        return None
    if not stdout:
        return None
    return stdout


async def _score_with_gemini(frame_bytes: bytes, job: ScreeningJob):
    model = _state["gemini_model"]
    prompt = GEMINI_PROMPT_TMPL.format(dareTitle=job.dareTitle, category=job.category)
    image_part = {
        "mime_type": "image/jpeg",
        "data": base64.b64encode(frame_bytes).decode("ascii"),
    }
    try:
        resp = await asyncio.to_thread(model.generate_content, [prompt, image_part])
    except Exception as e:
        log.warning("gemini call failed drop=%d: %s", job.dropId, e)
        return None

    text = (getattr(resp, "text", None) or "").strip()
    if not text:
        return None

    # Strip ```json fences if present
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        data = json.loads(text)
        pass_      = bool(data["pass"])
        confidence = float(data["confidence"])
        reason     = str(data.get("reason", "gemini"))[:240]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        return None

    confidence = max(0.0, min(1.0, confidence))
    return pass_, confidence, reason


def _stub_score(job: ScreeningJob) -> ScreeningResult:
    # No real AI is available, and a stub cannot judge a video — so it must NOT
    # auto-verify. Emit a sub-threshold confidence so every drop is routed to the
    # crowd (the API auto-resolves only at confidence >= 0.85).
    return ScreeningResult(
        dropId=job.dropId,
        pass_=False,
        confidence=STUB_DEFER_CONFIDENCE,
        reason="stub: no AI configured — routed to crowd",
    )


# ---- Callback to Go ---------------------------------------------------------

async def report_result(client: httpx.AsyncClient, result: ScreeningResult):
    payload = {
        "pass":       result.pass_,
        "confidence": result.confidence,
        "reason":     result.reason,
    }
    url = f"{API_URL}/internal/drops/{result.dropId}/screening-result"
    # Retry with backoff: a lost callback leaves the drop stuck in 'pending', so a
    # transient API/network failure (or a non-2xx) must not silently drop the verdict.
    delay = 1.0
    for attempt in range(1, REPORT_MAX_ATTEMPTS + 1):
        try:
            resp = await client.post(url, json=payload, headers={"X-Internal-Token": INTERNAL_API_SECRET}, timeout=10)
            resp.raise_for_status()
            return
        except Exception as e:
            if attempt == REPORT_MAX_ATTEMPTS:
                log.error("report failed permanently drop=%d after %d attempts: %s",
                          result.dropId, attempt, e)
                return
            log.warning("report retry drop=%d attempt=%d/%d in %.1fs: %s",
                        result.dropId, attempt, REPORT_MAX_ATTEMPTS, delay, e)
            await asyncio.sleep(delay)
            delay *= 2


# ---- Health -----------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    rdb = _state["rdb"]
    if rdb is None:
        return Response(content='{"status":"not_ready","reason":"redis_uninitialized"}',
                        status_code=503, media_type="application/json")
    try:
        await rdb.ping()
    except Exception as e:
        return Response(content=json.dumps({"status": "not_ready", "reason": str(e)}),
                        status_code=503, media_type="application/json")
    return {
        "status":         "ready",
        "gemini":         bool(_state["gemini_model"]),
        "concurrency":    CONCURRENCY,
        "in_flight":      _state["in_flight"],
        "shutting_down":  _state["shutdown"],
    }
