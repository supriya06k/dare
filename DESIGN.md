# Dare & Validate — Product & Backend Design Notes

**Status:** Draft / brainstorm v1
**Date:** 2026-06-24
**Authors:** PratyushS7 (brainstormed with GitHub Copilot CLI)
**Related:** `DOCS.md` (UI prototype documentation), `PRD_Dare_and_Validate.docx` (external, not in repo)

---

## 0. Why this document exists

`DOCS.md` documents *how the prototypes are built*. This document records *why the product
should work the way it does* — the reasoning, the decisions, and the data points behind them —
so that future contributors (human or AI agent) can pick this up later and understand the intent
without re-deriving it from scratch.

If a decision below is reversed, **don't delete the entry** — mark it superseded and add a new
one. The value of this file is the trail, not just the conclusion.

---

## 1. Where we are today

- Three self-contained, zero-dependency HTML/CSS/JS prototypes (`index.html`, `v2.html`,
  `option2.html`) explore three *visual/interaction* directions for the same concept.
- The team has converged on the **mandala** direction (`option2.html` active, `v2.html` frozen
  baseline, `index.html` archived).
- **What is decided:** the look and feel.
- **What is NOT decided (this doc):** the product mechanics, the trust model, the economy, and
  the backend. The prototypes are UI-only — mock data, no verification, no persistence, no auth.

---

## 2. The core insight

The product has exactly one novel primitive:

> **Socially-adjudicated proof-of-effort.** A challenge completion is *verified*, not just posted.

Everything else (challenges, leaderboards, video) already exists on TikTok/Instagram as
*hashtags* with no notion of truth. The verification layer is the entire moat.

**The uncomfortable corollary:** the value and the risk live in the *same* place. If verification
is trustworthy, this is a genuinely new thing. If it is gameable, points become noise, the prize
gets farmed, and we are a worse TikTok. **Every downstream decision is really an answer to
"how do we make verification un-gameable?"**

The prototype implies the weakest possible version — naive crowd voting (`ver: 48` verifiers, a
heart count). That is the first thing we change.

---

## 3. Problem inventory (ranked by how existential)

| # | Problem | Why it matters (data point) |
|---|---------|------------------------------|
| 1 | **Verification integrity — Sybil & collusion** | Friends upvote friends; sockpuppets farm verifications; lazy "looks good 👍" approvals. Naive crowd voting is trivially gamed. This is the existential problem — solve it or nothing else matters. |
| 2 | **Trust & Safety** | Dares + video + virality is the blackout-challenge / Tide-pod problem (real deaths, real lawsuits). Plus NSFW, harassment, and music IP in the rap dare. Legal-existential, not backlog. |
| 3 | **Marketplace cold-start** | Two-sided (doers *and* verifiers). Early on, submissions rot unverified or verifiers have nothing to do. Classic chicken-and-egg liquidity problem. |
| 4 | **Verifier incentive** | Judging a stranger's juggling video is unpaid labor. Without a reason (reputation, points, required-to-play), the verifier side collapses. |
| 5 | **Subjective vs objective challenges** | "100 reps under 3 min" is rule-checkable; "draw a recognizable portrait" is taste. Mixing them detonates disputes. |
| 6 | **Payout fraud** | A real cash prize ($500/season in the mock) summons fraud rings → KYC + anomaly detection become mandatory the moment money is involved. |

---

## 4. Decisions (ADR-style)

Each decision records: **Context → Decision → Rationale/data points → Alternatives considered →
Consequences.**

### ADR-001 — Layered, staked verification (NOT naive crowd voting)
- **Status:** Accepted
- **Context:** Verification integrity (Problem #1) is existential; raw crowd votes are trivially
  Sybil-able and collusion-prone.
- **Decision:** Replace crowd voting with a 3-layer pipeline:
  - **Layer 0 — automated gate:** visible timer present, correct clip length, body/face in frame
    (ML), and a **perceptual hash** to detect reused/stolen video. Cheap rejects before any human
    looks.
  - **Layer 1 — staked random jury:** N reputation-weighted reviewers, **selected to exclude the
    submitter's social graph**, voting via **commit-reveal** (can't copy others' votes).
    Agreeing with consensus earns reputation; being an outlier loses it.
  - **Layer 2 — dispute escalation** to higher-reputation jurors / moderators.
- **Rationale / data points:** This is the Schelling-point / staked-juror model proven by systems
  like **Kleros** — specifically engineered to make collusion expensive and honesty the
  equilibrium. Graph exclusion defeats the friends-verify-friends attack; commit-reveal defeats
  vote-copying; staking reputation defeats lazy approvals.
- **Alternatives considered:**
  - *Naive crowd voting* — rejected (the thing we're fixing).
  - *Pure-AI verification* — rejected as sole mechanism: can't judge nuance, is spoofable, and
    removes the social/community value. Used only as Layer 0.
  - *Centralized moderators only* — rejected: doesn't scale, expensive, no community ownership.
- **Consequences:** Requires a reputation system (ADR-004), a juror-selection service with
  social-graph data, and commit-reveal storage. Higher backend complexity, but it's the moat.

### ADR-002 — "Dares with stakes" as the demand engine
- **Status:** Accepted
- **Context:** Cold-start (Problem #3) and verifier incentive (Problem #4).
- **Decision:** Lean into the name. Let users **dare each other** (1:1 or broadcast), optionally
  **staking points**. The challenger becomes a motivated verifier.
- **Rationale / data points:** A challenger who staked points *wants* to verify the outcome,
  which seeds the verifier side. Personal dares ride the existing social graph, driving invites —
  the cheapest known fix for marketplace cold-start (referral-driven liquidity).
- **Alternatives considered:** *Open challenge board only* — kept, but it doesn't bootstrap
  demand by itself.
- **Consequences:** Needs a stake/escrow concept in the points ledger and a directed
  "dare" relationship between users.

### ADR-003 — Objective challenges first; subjective ones are *rated*, later
- **Status:** Accepted
- **Context:** Subjectivity (Problem #5) blows up verification disputes.
- **Decision:** Launch with only rule-checkable challenges (reps, timed feats, speedruns) where
  verification is near-automatable. Add creative/subjective challenges later as **rated**
  (a score distribution), never binary pass/fail.
- **Rationale / data points:** Objective challenges let Layer 0 do real work and keep Layer 1
  disagreements rare while community norms and reputation are still forming. Rating-not-verdict
  matches how subjective skill is actually judged (diving, gymnastics — panel scores, drop
  outliers).
- **Consequences:** Challenge schema must carry a `verification_type` (objective rule-set vs
  subjective rubric). Catalog launches narrow.

### ADR-004 — Two currencies: `points` vs `reputation`
- **Status:** Accepted
- **Context:** The prototype conflates engagement and trust into one number.
- **Decision:** Split them. **Points** = leaderboard score (fun, seasonal, resettable).
  **Reputation** = trust weight in verification + anti-abuse (slow-moving, persistent).
- **Rationale / data points:** Trust must not be buyable with grind, and fun must not be gated by
  trust. Conflating them lets a high-volume farmer dominate verification. Two numbers, two
  half-lives.
- **Consequences:** Identity/Profile owns reputation; Scoring owns points. Verification reads
  reputation; juror outcomes write it.

### ADR-005 — Submission is a state machine, not a flag
- **Status:** Accepted
- **Decision:** Model the lifecycle explicitly:
  `draft → submitted → auto-screening → in-jury → verified | rejected → disputed → resolved`.
- **Rationale / data points:** Every interesting bug, audit question, and retry lives in a
  transition. A boolean `verified` field can't express "screening passed but jury is mid-round"
  or "rejected then disputed."
- **Consequences:** Transitions emit events (see §6) and are individually auditable.

### ADR-006 — Append-only points ledger
- **Status:** Accepted
- **Decision:** Never mutate a balance. A balance is the sum of immutable, idempotent ledger
  entries.
- **Rationale / data points:** Standard practice anywhere score or money has integrity
  requirements (double-entry accounting). Enables audit, dispute replay, and safe retries on an
  at-least-once message bus.
- **Consequences:** Reads aggregate (cached in Redis); writes append.

### ADR-007 — Perceptual hashing for anti-replay
- **Status:** Accepted
- **Decision:** Compute a perceptual hash of every submitted video; reject near-duplicates of
  prior or other users' submissions.
- **Rationale / data points:** Re-submitting an old or stolen clip is the #1 cheapest cheat.
  Perceptual (not cryptographic) hashing catches re-encodes/crops that byte hashes miss.
- **Consequences:** Media pipeline computes and indexes hashes; Submission queries them in
  Layer 0.

### ADR-008 — Trust & Safety from day one
- **Status:** Accepted
- **Decision:** Ship with a challenge-approval queue, a banned/dangerous-dare classifier,
  age-gating, a report flow, and rate limits *before* launch — not after an incident.
- **Rationale / data points:** The dangerous-challenge failure mode is catastrophic and
  irreversible (harm + legal). Retrofitting safety after virality is the documented industry
  failure pattern.
- **Consequences:** A Trust & Safety service is core infrastructure, not an add-on.

---

## 5. Product model

### 5.1 Currencies
- **Points** — seasonal leaderboard score; earned on verified completions; can be staked on
  dares; resets each season.
- **Reputation** — persistent trust weight; earned by being a correct juror and a clean doer;
  drives juror selection weighting and anti-abuse thresholds.

### 5.2 Submission lifecycle
```
draft → submitted → auto-screening ─pass→ in-jury ─consensus→ verified
                          │                   │
                          └─fail→ rejected    └─no-consensus→ disputed → resolved
```

### 5.3 Challenge taxonomy
- `verification_type: objective` — structured, machine-evaluable rules (timer, count, duration).
  Binary verdict.
- `verification_type: subjective` — rubric + panel **rating** (score distribution, drop
  outliers). Deferred to post-launch.

### 5.4 Verification flow (the heart)
1. **Layer 0 (auto):** format/timer/length/in-frame checks + perceptual-hash replay check.
2. **Layer 1 (jury):** select N reputation-weighted jurors excluding the submitter's social
   graph → commit-reveal vote → consensus → reputation deltas (correct = +, outlier = −).
3. **Layer 2 (dispute):** escalate contested cases to higher-reputation jurors / moderators.

### 5.5 Economy & seasons
Seasons are the competition unit (already in the prototype: "Season 1 — resets in 14 days").
Points reset per season; reputation does not. A season prize, if real money, triggers KYC and
fraud checks (Problem #6) — deferred but noted.

---

## 6. Backend architecture (proposed)

**Default stack:** C#/.NET + Azure (matches the team's production world). Stack-agnostic in
principle — swap equivalents as needed.

### 6.1 Bounded contexts (services)

| Service | Owns | Notes |
|---------|------|-------|
| **Identity / Profile** | users, auth, **reputation** | Entra External ID (B2C); reputation is the trust spine |
| **Challenge Catalog** | challenge defs, typed rules, categories, seasons | rules structured so Layer 0 can evaluate them |
| **Submission** | proof intake, lifecycle state machine | video uploaded **direct-to-Blob via SAS**, not through the API |
| **Verification** | juror selection, commit-reveal voting, consensus, disputes | anti-collusion lives here |
| **Scoring / Leaderboard** | append-only points ledger, season rollups | Redis **sorted sets** for live boards |
| **Media Pipeline** | transcode, thumbnail, ML (timer/face/body), perceptual hash | worker pool; ffmpeg / Azure AI |
| **Trust & Safety** | content moderation, dangerous-dare detection, fraud/anomaly | Azure AI Content Safety + offline collusion-graph batch |
| **Notifications** | "verified!", "you're a juror" | push / email |

### 6.2 Event-driven spine
```
Submission accepted
  └─[event] ProofSubmitted
       └─ Media Pipeline: transcode + ML + perceptual hash
            └─[event] ProofScreened (pass | fail)
                 └─ Verification: open jury round (reputation-weighted, graph-excluded)
                      └─ commit-reveal votes → consensus
                           └─[event] SubmissionVerified | SubmissionRejected
                                ├─ Scoring: append to ledger, update Redis leaderboard
                                ├─ Identity: adjust juror + doer reputation
                                └─ Notifications: notify participants
```
- **Bus:** Azure Service Bus with the **outbox pattern** so a state change and its event commit
  atomically (no lost/duplicate verifications on an at-least-once bus).
- **Idempotency:** every consumer is idempotent; ledger entries carry a dedupe key.

### 6.3 Data stores
- **Azure SQL / PostgreSQL** — transactional: users, challenges, submissions, votes, ledger.
- **Blob Storage** — raw + transcoded video.
- **Redis** — leaderboard sorted sets, hot counters (`hype`/`ver`).
- **Social graph** — relational now; a graph store later if collusion detection needs it.

### 6.4 Data model sketch (core entities)
- `User(id, handle, reputation, created_at)`
- `Challenge(id, title, category, verification_type, rules_json, season_id, status)`
- `Submission(id, user_id, challenge_id, video_blob_ref, phash, state, created_at)`
- `JuryRound(id, submission_id, opened_at, status)`
- `Vote(id, jury_round_id, juror_id, commit_hash, revealed_verdict, revealed_at)`
- `LedgerEntry(id, user_id, season_id, delta, reason, ref_id, dedupe_key, created_at)`
- `Dare(id, from_user_id, to_user_id|broadcast, challenge_id, stake_points, status)`
- `Report(id, target_type, target_id, reporter_id, reason, status)`

### 6.5 Integrity & anti-abuse (cross-cutting)
- Append-only, idempotent ledger; every state transition audited.
- Verification rounds deterministic and **replayable** for dispute review.
- Rate limits, device/IP velocity signals, and an **offline collusion-graph job** that flags
  voting rings.

### 6.6 Frontend
The canvas prototypes become a thin client over a BFF/API: wire real data into `DARES`, the
leaderboard, and the submit "rite." Minimal logic change to `option2.html`.

---

## 7. Open questions / deferred

- **Reputation math:** exact earn/decay curve, starting value, juror-weighting function.
- **Juror rewards:** points for verifying? required-to-play quota? both?
- **Payout / KYC:** only if the season prize is real money. Anti-fraud + identity verification.
- **Moderation tooling:** human review console, escalation SLAs.
- **Platform:** mobile-first (native?) vs web — affects on-device ML for Layer 0.
- **Monetization:** sponsored challenges, premium seasons, brand prize pools.

---

## 8. Decision log

| Date | Change |
|------|--------|
| 2026-06-24 | Initial draft. Core insight + Problems #1–6 + ADR-001…008 + product model + backend sketch. |
