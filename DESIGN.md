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

### ADR-009 — Reputation model (start, asymmetric updates, sublinear weight, decay)
- **Status:** Accepted
- **Context:** ADR-001 needs a trust metric to weight jurors and resist Sybil/farming.
- **Decision:**
  - `R ∈ [0, 1000]`, new users start at **50** (low but non-zero).
  - Earned **only** via correct jurying (primary signal) and clean doing (secondary). Never from
    points/grind (preserves ADR-004 separation).
  - **Asymmetric updates:** matched-consensus juror gains `k·(1 − R/Rmax)` (diminishing near the
    top); outlier juror loses `k₂·(R/Rmax)` (a high-rep juror has the *most* to lose).
  - **Decay:** nightly `R = base + (R − base)·exp(−Δt/τ)`, half-life **τ ≈ 90 days**.
  - **Juror vote weight is sublinear:** `w = R^0.6` (whales can contest a round, not dictate it).
  - **Binding-juror floor** (e.g. `R ≥ 150`); below the floor a user is an *apprentice* casting
    non-binding shadow votes scored against the binding consensus until they graduate.
- **Rationale / data points:** Diminishing gains cap power (no infinite grind); proportional
  outlier loss keeps the most-trusted jurors honest; sublinear weight prevents whale capture;
  decay reflects *recent* trust; the floor denies Sybil accounts any jury power. Same incentive
  shape as Kleros staked jurors and the Stack Overflow reputation-privilege ladder.
- **Alternatives considered:** linear weight (rejected — whale capture); permanent reputation
  (rejected — stale power lingers); points-buyable trust (rejected — violates ADR-004).
- **Consequences:** append-only `ReputationEvent` stream + a nightly decay job; Identity/Profile
  owns `R`; the apprenticeship needs shadow-vote storage.

### ADR-010 — Jury engine (selection + commit-reveal + weighted consensus)
- **Status:** Accepted
- **Context:** Operationalize ADR-001's Layer 1.
- **Decision:**
  - **Panel size `N` scales with stakes:** 3 (casual) → 7 (staked / dispute).
  - **Selection:** `R ≥ floor`, **exclude the submitter's social graph** and conflicts (e.g. the
    challenger), **randomized + cooldown** so the same whales aren't always chosen, weighted by
    `R^0.6`.
  - **Commit–reveal:** jurors submit a blind `hash(verdict + salt)`, then reveal `verdict + salt`
    (re-hash must match). Non-revealers take a small rep hit and are replaced.
  - **Structured verdict:** `pass | fail` + `failed_rule_id` for objective challenges (not a vibe).
  - **Consensus:** reputation-weighted majority at a **≈66% threshold**; on a genuine split,
    **expand the panel** or route to dispute (no coin-flip).
  - **Settlement:** matched jurors gain reputation, outliers lose (per ADR-009).
- **Rationale / data points:** graph exclusion kills friends-verify-friends; commit-reveal kills
  vote-copying/bandwagon; randomization + cooldown resists juror capture/fatigue; weighting honors
  earned trust without letting it dominate; the Schelling-point equilibrium makes honest
  convergence the rational vote, and for rule-checkable dares that convergence *is* the truth.
  Collusion must coordinate across a random, graph-excluded, blind-committed panel — expensive and
  fragile by construction.
- **Alternatives considered:** open voting (rejected — copying/bandwagon); unweighted simple
  majority (rejected — ignores trust); pure-AI verdict as sole mechanism (rejected — see ADR-001).
- **Consequences:** the Verification service owns round lifecycle, selection, and consensus; rounds
  are deterministic and **replayable** for dispute review.

### ADR-011 — Verification timing: hybrid async-first + optimistic pending + jury-to-play
- **Status:** Accepted
- **Context:** The integrity ↔ latency ↔ liquidity tension. A cold juror pool cannot sustain
  large synchronous panels; a mature pool shouldn't be throttled to async speed.
- **Decision:**
  - **Hybrid:** attempt a **synchronous fast-path** (fill a panel within a short timeout, e.g.
    ~90s → verdict in minutes); **fall back to async windows** (commit/reveal over hours) when the
    pool is thin.
  - **Optimistic pending UX:** on Layer-0 pass, immediately show *"submitted — pending"*; the doer
    keeps playing while verification resolves in the background; points post as `pending` then
    `confirmed`. (The prototype already gestures at this with its *"+N pts pending"* ascension
    screen.)
  - **Jury-to-play:** gate submission behind a small judging quota so juror *supply* scales with
    *demand*. Self-sufficiency constraint: **`K ≥ N`** (each round consumes `N` juror-slots; each
    submitter supplies `K`). `K` may dip below `N` only to the extent organic + apprentice
    shadow-vote supply exists. Lazy judging is penalized via reputation so the quota isn't gamed.
  - **Maps to the staged rollout:** Phase 1 = async-only + pending + jury-to-play (optimize
    liquidity); Phase 2 = enable the sync fast-path as concurrency grows (optimize speed).
- **Rationale / data points:** latency only hurts a *blocked* user — optimistic pending removes the
  block, making async tolerable from day one; jury-to-play ties supply to the same online
  population that creates demand, which *also* makes the sync fast-path increasingly fillable;
  hybrid degrades gracefully and is the natural migration path, avoiding a one-way-door bet on
  either extreme.
- **Alternatives considered:** sync-only (rejected — dead lobbies at low liquidity); async-only
  (rejected — sluggish at scale, wastes a healthy pool's speed). Hybrid spans both endpoints.
- **Consequences:** two code paths plus a sync→async handoff mid-round; `K` and the lazy-judging
  penalty need empirical tuning; the points ledger needs `pending|confirmed|void` states (§6.4).

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

### 5.6 Verification core — the complete flow (with worked example)

Mental model: a **small courthouse for dares**. A claim of completion is a *case*; the machinery
below is just how that court reaches a cheat-resistant verdict.

| Court concept | Our system |
|---|---|
| The case | A submission (video proof) |
| Clerk checking paperwork | Layer 0 (automated screening) |
| Randomly summoned jurors | Reputation-weighted juror panel |
| A juror's track record | Reputation (ADR-009) |
| Jurors writing verdicts privately | Commit–reveal (ADR-010) |
| Appeal to a higher court | Layer 2 dispute |

**End-to-end, following one submission ("Maya" attempts the 100-reps dare):**

1. **Intake** — video uploads direct-to-Blob; `Submission` created, state `submitted`.
2. **Layer 0 (auto)** — timer/length/in-frame ML checks + perceptual-hash replay check.
   *Why first:* protects scarce human attention; kills the cheapest cheat (reused/stolen clips)
   for free. Fail → `rejected`; pass → `in-jury`.
3. **Summon jury** — pick `N` jurors with `R ≥ floor`, **social-graph excluded**, randomized +
   cooldown, weighted by `R^0.6`. *Stops:* Sybil armies (floor), friends-verify-friends (graph),
   insider cliques (randomization).
4. **Commit** — each juror submits a sealed `hash(verdict + salt)`, blind. *Stops:*
   vote-copying/bandwagon.
5. **Reveal** — jurors reveal `verdict + salt`; re-hash must match (proves they committed before
   seeing others). Non-revealers penalized + replaced.
6. **Consensus** — reputation-weighted tally vs a ~66% threshold. Split → expand panel or dispute.
7. **Settlement** — matched jurors gain reputation, outliers lose (ADR-009); doer gains points +
   doer-reputation if verified.
8. **Score & notify** — append-only ledger entry; Redis leaderboard update; notifications.
9. **Appeal window** — submitter/challenger may appeal with a **stake** → larger, higher-rep
   panel; final.

**Worked example (Step 6–7), `w = R^0.6`:**

| Juror | R | Weight `w` | Vote |
|---|---|---|---|
| Alice | 400 | ~36 | PASS |
| Bob | 200 | ~24 | FAIL |
| Carlos | 900 | ~59 | PASS |

Weighted PASS = 36 + 59 = 95; FAIL = 24 → PASS share **80% ≥ 66% → VERIFIED**.
Settlement (`k=25, k₂=40, Rmax=1000`): Alice `+25·(1−0.4)=+15`→415; Carlos `+25·(1−0.9)=+2.5`→902.5
(diminishing near top); Bob (outlier) `−40·0.2=−8`→192. Note a lone whale (Carlos) voting FAIL
against Alice+Bob would land ≈50% → *no consensus*, not a whale win — that is the sublinear-weight
cap working as intended.

### 5.7 Verification timing model (see ADR-011)

"Timing" is really three coupled questions: **doer latency**, **juror supply**, and **minimum
pool size**.

| Model | Doer latency | Supply needed | Min pool | Feels like |
|---|---|---|---|---|
| Synchronous (min) | Instant | Many online *now* | Large | Live matchmaking |
| Async (12h windows) | Up to a day | A few, *sometime* | Small | Mod queue |
| **Hybrid (chosen)** | Fast when possible | Adapts | Any | Matchmaking + fallback |

Two reframes make latency stop mattering: **(1) optimistic pending** (don't block the doer — they
keep playing, points confirm later; the prototype already shows *"+N pts pending"*), and
**(2) jury-to-play** (every doer is also a juror, so supply scales with demand; constraint
`K ≥ N`). Chosen direction: **hybrid, async-first**, with both reframes — it works from day one and
is the natural migration path to fast verdicts as the pool grows.

### 5.8 Tunable parameters (starting defaults — to be calibrated empirically)

| Knob | Default | Source |
|---|---|---|
| Start reputation | 50 | ADR-009 |
| Binding-juror floor | 150 | ADR-009 |
| Panel size `N` | 3 (casual) → 7 (staked/dispute) | ADR-010 |
| Consensus threshold | 66% weighted | ADR-010 |
| Vote weight | `R^0.6` | ADR-009 |
| Reputation decay half-life `τ` | 90 days | ADR-009 |
| Gain / loss constants `k`, `k₂` | 25 / 40 | ADR-009 (tune) |
| Sync fast-path fill timeout | ~90s → async fallback | ADR-011 |
| Commit / reveal windows (async) | 12h / 12h | ADR-011 |
| Jury-to-play ratio `K` | `≥ N` | ADR-011 |
| Apprentice graduation | 20 correct shadow votes @ ≥80% | ADR-009 |

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
- `JuryRound(id, submission_id, panel_size, mode[sync|async], commit_deadline, reveal_deadline, opened_at, status)`
- `Vote(id, jury_round_id, juror_id, commit_hash, revealed_verdict, failed_rule_id, salt, revealed_at, matched_consensus)`
- `ShadowVote(id, submission_id, apprentice_id, verdict, matched_consensus, created_at)`  // apprenticeship (ADR-009)
- `ReputationEvent(id, user_id, delta, reason, ref_id, created_at)`  // append-only; balance = Σ deltas + decay
- `LedgerEntry(id, user_id, season_id, delta, reason, ref_id, dedupe_key, status[pending|confirmed|void], created_at)`
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

- ~~**Reputation math**~~ — **decided (ADR-009):** start 50, asymmetric updates, `R^0.6` weight,
  90-day decay. *Residual:* calibrate constants `k`, `k₂` empirically.
- ~~**Juror rewards / supply**~~ — **decided (ADR-011):** jury-to-play with `K ≥ N`, plus
  reputation. *Residual:* tune `K` and the lazy-judging quality penalty.
- ~~**Verification timing**~~ — **decided (ADR-011):** hybrid async-first + optimistic pending.
  *Residual:* sync fast-path fill timeout.
- **Payout / KYC:** only if the season prize is real money. Anti-fraud + identity verification.
- **Moderation tooling:** human review console, escalation SLAs.
- **Platform:** mobile-first (native?) vs web — affects on-device ML for Layer 0.
- **Monetization:** sponsored challenges, premium seasons, brand prize pools.

---

## 8. Decision log

| Date | Change |
|------|--------|
| 2026-06-24 | Initial draft. Core insight + Problems #1–6 + ADR-001…008 + product model + backend sketch. |
| 2026-06-24 | Verification core locked: ADR-009 (reputation model), ADR-010 (jury engine + commit-reveal), ADR-011 (hybrid timing + optimistic pending + jury-to-play). Added §5.6–5.8 (flow walkthrough, timing model, parameters) and extended the §6.4 data model. |
