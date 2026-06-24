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

### ADR-012 — Curated-catalog-first + challenge approval gate + dangerous-dare taxonomy
- **Status:** Accepted
- **Context:** Trust & Safety (Problem #2) is the second existential risk. The core loop
  ("do a dare, film it") is the highest-risk content category, *amplified* by points/prize/
  leaderboard and aimed at a young audience. The highest-leverage lever is **who decides what a
  dare can be.**
- **Decision:** Phase 1 is a **platform-curated catalog** — vetted authors create challenges;
  users *do* them, they don't *invent* them. Challenge lifecycle:
  `proposed → safety-review → approved | rejected → live → retired`. Every proposed challenge is
  scored by a **dangerous-dare classifier** against a banned-category taxonomy (physical harm,
  self-harm, illegal acts, sexual, targeting minors, animal cruelty, harassment-by-design) and
  routed by **risk tier**: auto-reject / human-review / auto-approve + spot-check. Each challenge
  carries structured **risk metadata** (physical-risk, `requires_other_people`, location-risk,
  age-rating). User-proposed dares open in Phase 2 behind the same gate + a reputation requirement
  + community flagging.
- **Rationale / data points:** this controls the danger surface *at the source* — ~80% of the
  safety posture. Challenge virality is *driven* by danger (blackout, Tide-Pod, "devious licks"),
  and paying for completion + status accelerates it; controlling authorship is the only durable
  defense. Aligns with ADR-003 (objective-first).
- **Alternatives considered:** open UGC dares from day one (rejected — rebuilds unmoderated
  challenge chaos); post-hoc moderation only (rejected — reactive, harm already done).
- **Consequences:** Challenge gains lifecycle + risk metadata; T&S service owns the approval
  workflow + taxonomy; the launch catalog is intentionally narrow.

### ADR-013 — Content-safety screening at submission (extends Layer 0; never auto-publish flagged)
- **Status:** Accepted
- **Context:** A safe challenge can still produce unsafe footage — nudity, violence, bystander
  PII, a minor in danger, self-harm/distress.
- **Decision:** Extend the verification Layer-0 gate with automated content moderation on every
  submission (sexual/nudity, graphic violence/weapons; minor-safety signals; PII/bystander faces
  & plates/addresses → blur or reject; self-harm/distress → route to crisis resources, not points).
  **Flagged content is blocked from the public + jury flow and escalated to humans — never
  auto-published (fail-closed).**
- **Rationale / data points:** the fail-closed rule prevents the catastrophic case; reuses the
  existing media pipeline + Layer-0 entry point (low marginal cost); also protects *jurors* from
  being shown harmful content.
- **Alternatives considered:** moderate only on report (rejected — harmful content goes live
  first); moderate only at jury time (rejected — too late, exposes jurors).
- **Consequences:** Media Pipeline runs moderation ML; Submission gains a `safety_state`; flagged
  items enter a moderation queue.

### ADR-014 — Dares constrained to the vetted catalog + consent & rate-limits (conduct safety)
- **Status:** Accepted
- **Context:** Stake-dares and "dare someone" are a harassment vector (humiliation, pile-ons).
- **Decision:** A user may only dare another to a **vetted catalog challenge** — never a free-text
  instruction (Phase 1). Plus consent to receive dares (off for non-followers by default),
  rate-limited dares-to-one-person, and block/mute.
- **Rationale / data points:** constraining dares to vetted challenges **structurally eliminates**
  free-text harassment in Phase 1 — you cannot weaponise a juggling challenge. Cheap, total, and
  reuses the catalog.
- **Alternatives considered:** free-text dares with moderation (rejected — moderation can't keep
  pace with targeted, interpersonal abuse).
- **Consequences:** `Dare` references a `challenge_id` (already modelled); add consent + rate-limit
  user settings.

### ADR-015 — Age assurance & minor-safety defaults
- **Status:** Accepted
- **Context:** The audience skews young; minors + dares + video + money is the most heavily
  regulated combination (COPPA, UK AADC, EU DSA).
- **Decision:** Age assurance at signup; minor accounts default to **curated-only, no cash prize,
  limited dares**, and stricter content defaults.
- **Rationale / data points:** regulatory necessity + harm reduction — removing cash for minors
  removes the worst incentive to escalate.
- **Alternatives considered:** treat all users identically (rejected — legal and ethical
  non-starter).
- **Consequences:** `User` carries an `age_band`; gating logic spans challenge eligibility,
  prizes, and dares.

### ADR-016 — Reporting & escalation reusing jury + reputation, with staff SLAs
- **Status:** Accepted
- **Context:** No gate is perfect; we need a fast path for what slips through.
- **Decision:** Every surface (challenge, submission, user, dare) is reportable → triage queue.
  Reuse jury + reputation for community triage; **imminent-harm categories bypass the community and
  go straight to staff moderators with a tight SLA (e.g. < 1h).** Versioned **policy-as-data**,
  full audit log, and appeals.
- **Rationale / data points:** reuses existing trust infrastructure (low cost); the imminent-harm
  fast lane is the difference between an incident and a tragedy; policy-as-data keeps decisions
  auditable and evolvable without code deploys.
- **Alternatives considered:** staff-only moderation (rejected — doesn't scale); community-only
  (rejected — too slow for imminent harm).
- **Consequences:** T&S service owns the triage queue, moderator console, action taxonomy, SLAs,
  appeals, and safety telemetry.

### ADR-017 — Non-cashable currency + prize-as-contest (the gambling firewall)
- **Status:** Accepted
- **Context:** A cash prize alongside stakeable points risks constituting **unlicensed gambling**
  (consideration + outcome + prize of value) → illegal in most jurisdictions + app-store ban.
  Same existential tier as safety.
- **Decision:** In-app currencies (Score, Coins) are **non-cashable** — they never convert to
  money. Staking Coins is therefore a *status wager*, not gambling. The season prize is a
  **platform-funded skill contest / sweepstakes** awarded to top ranks — **not** a points→cash
  conversion. Money only ever flows *in* (cosmetics, sponsorship); never out as a cash-out.
- **Rationale / data points:** removing the "prize of monetary value" and "cash-out" prongs is the
  structural firewall against gambling + money-transmitter law; platform-funded skill-contest
  prizes are a different, manageable regime (contest/sweepstakes terms). *Risk reduction, not legal
  advice — a real launch needs counsel.*
- **Alternatives considered:** cashable points (rejected — gambling / money-transmitter exposure,
  app-store ban); points→cash on dares (rejected — that is wagering).
- **Consequences:** monetization cannot rely on cash-out; the prize runs under contest rules with
  winner eligibility + KYC at payout time only.

### ADR-018 — Separate Score (rank, earned-only) from Coins (spendable wallet)
- **Status:** Accepted (refines ADR-004)
- **Context:** If the currency that *ranks* the leaderboard is also transferable via stakes,
  players wash-trade to **buy rank** (A repeatedly "loses" to friend B).
- **Decision:** Split the points-family into **Score** (earned only via verified completions,
  **non-transferable**, ranks the leaderboard, resets per season) and **Coins** (spendable/
  stakeable wallet; sources = completions/events; sinks = stakes/entry fees/cosmetics). Reputation
  (ADR-009) remains the separate trust currency.
- **Rationale / data points:** rank then reflects merit, not transfers — same separation-of-roles
  logic as ADR-004. Cost: a third currency adds UX/cognitive load, accepted in exchange for an
  honest leaderboard.
- **Alternatives considered:** single points currency (rejected — buy-rank wash trading);
  transferable Score (rejected — same hole).
- **Consequences:** `LedgerEntry` carries `currency[score|coins]`; rank queries read Score only;
  stakes touch Coins only.

### ADR-019 — Dare-stake lifecycle & escrow; bounty-first
- **Status:** Accepted
- **Context:** ADR-002's stake mechanic needs concrete escrow/payout/anti-griefing rules; staking
  is also a coercion vector (ADR-014).
- **Decision:**
  - *"Dare someone"* uses a **bounty model**: the challenger funds a Coins bounty; the
    **challengee risks nothing** and completes to win it. Opt-in **mutual-stake duels** (both
    stake, winner takes the pot) for willing rivals only.
  - **Escrow state machine:** `created (funds held) → pending → accepted → active → submitted →
    [graph-excluded jury] → resolved → payout | declined/expired/timeout → refund`.
  - Wins are still gated by the normal verification jury — a win cannot be handed.
  - Consent + rate-limits per ADR-014.
- **Rationale / data points:** bounty avoids coercion/griefing (no one can be drained by
  spam-dares); jury-gated wins + earned-only Score (ADR-018) stop wash payouts from moving rank;
  escrow with refund-on-timeout protects funds.
- **Alternatives considered:** mutual-stake as default (rejected — coercive/griefable);
  self-claimed auto-win (rejected — bypasses verification).
- **Consequences:** `Dare` gains mode/bounty/escrow/expiry fields; add `EscrowHold`; ties to the
  Coins ledger.

### ADR-020 — Anti-inflation & anti-farming
- **Status:** Accepted
- **Context:** Minting (completion rewards) without controls inflates the currency and rewards
  mindless grinding.
- **Decision:** Completion minting is **difficulty-weighted + diminishing-returns (per challenge
  per period) + rate-limited**; defined **sinks** (stake escrow/transfer, entry-fee and cosmetic
  burns); Score is earned-only and **seasonal (resets)**; the offline collusion job flags repeated
  A↔B Coin transfers (wash-stake rings).
- **Rationale / data points:** balancing sources against sinks keeps currency scarce and rank
  meaningful; seasonal reset stops permanent hoarding from distorting competition; collusion flags
  catch the transfer channel that staking introduces.
- **Alternatives considered:** flat rewards with no sinks (rejected — inflation + grind-to-win).
- **Consequences:** the reward function is difficulty/rate aware; sink mechanics required; the
  §6.5 collusion job extends to Coin transfers.

---

## 5. Product model

### 5.1 Currencies (refined by ADR-018)
Three distinct currencies, separated by role:
- **Score** — merit/rank. Earned **only** via verified completions (difficulty-weighted),
  **non-transferable**, ranks the leaderboard, resets each season.
- **Coins** — spendable wallet. Sources: completions / events. Sinks: dare stakes (escrow), entry
  fees, cosmetics. Stakeable and transferable (the economy layer), but **non-cashable** (ADR-017).
- **Reputation** — persistent trust weight (ADR-009); not spendable, not rank; drives juror
  selection and anti-abuse.

(Earlier mentions of "points" map onto Score + Coins; ADR-004's points-vs-reputation split is
preserved — Score and Coins are both points-family, distinct from Reputation.)

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

### 5.9 Safety model — surfaces & challenge lifecycle (see ADR-012…016)

Three safety surfaces, each gated independently:

- **A. Challenge safety** — is the *dare itself* dangerous? Prevention at the source via a curated
  catalog + approval gate (ADR-012).
- **B. Content safety** — is the *video* harmful (nudity, violence, bystander PII, a minor in
  danger, self-harm)? Detection at intake, extending verification Layer 0 (ADR-013).
- **C. Conduct safety** — is a *dare* being weaponised against a person? Neutralised by limiting
  dares to vetted challenges + consent/rate-limits (ADR-014).

**Challenge lifecycle:**
```
proposed → safety-review ─approve→ live → retired
                  └─reject→ rejected
```
Risk-tier routing: auto-reject (clearly dangerous) / human-review (borderline) / auto-approve +
spot-check (clearly benign). Phase 1 = platform-curated catalog; Phase 2 opens user proposals
through the same gate + a reputation requirement. Minor accounts (ADR-015) see only age-rated
challenges and never a cash prize.

### 5.10 Economy model — sources, sinks & the dare-stake loop (see ADR-017…020)

**Gambling firewall (ADR-017):** in-app currencies are **non-cashable**; staking Coins is a status
wager, not gambling; the season prize is a **platform-funded skill contest**, never a points→cash
conversion. Money only flows *in* (cosmetics/sponsorship), never out.

**Sources (mint) vs sinks (burn/escrow):**

| Flow | Currency | Mechanism |
|------|----------|-----------|
| Source | Score + Coins | verified completion — difficulty-weighted, diminishing, rate-limited (ADR-020) |
| Sink | Coins | dare stake (escrowed → transferred to winner; zero-sum) |
| Sink | Coins | entry fees / cosmetics (burned) |
| (neither) | Score | earned-only, non-transferable — never a sink/transfer (protects rank) |

**Dare-stake loop (bounty-first, ADR-019):**
```
created (challenger funds bounty in Coins → escrow)
  → pending → accepted → active → submitted
       → [graph-excluded verification jury] → resolved → payout to winner
  → declined / expired / timeout → refund
```
"Dare someone" = challenger funds a bounty, **challengee risks nothing**. Opt-in **mutual-stake
duels** (both stake, winner takes the pot) for willing rivals. Wins are always jury-gated (no
handing a win); earned-only Score means stake transfers never move rank; the offline collusion job
flags A↔B wash-stake rings.

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
- `User(id, handle, reputation, age_band, created_at)`
- `Challenge(id, title, category, verification_type, rules_json, season_id, lifecycle_state, risk_tier, risk_meta_json{physical_risk, requires_other_people, location_risk, age_rating}, status)`
- `Submission(id, user_id, challenge_id, video_blob_ref, phash, state, safety_state[pending|clear|flagged|blocked], created_at)`
- `JuryRound(id, submission_id, panel_size, mode[sync|async], commit_deadline, reveal_deadline, opened_at, status)`
- `Vote(id, jury_round_id, juror_id, commit_hash, revealed_verdict, failed_rule_id, salt, revealed_at, matched_consensus)`
- `ShadowVote(id, submission_id, apprentice_id, verdict, matched_consensus, created_at)`  // apprenticeship (ADR-009)
- `ReputationEvent(id, user_id, delta, reason, ref_id, created_at)`  // append-only; balance = Σ deltas + decay
- `LedgerEntry(id, user_id, season_id, currency[score|coins], delta, reason, ref_id, dedupe_key, status[pending|confirmed|void], created_at)`  // rank reads score only; stakes touch coins
- `Dare(id, from_user_id, to_user_id|broadcast, challenge_id, mode[bounty|duel], bounty_coins, escrow_state, resolution, expires_at, status)`
- `EscrowHold(id, dare_id, user_id, amount_coins, state[held|released|refunded], created_at)`  // ADR-019
- `Report(id, target_type, target_id, reporter_id, category, severity, status, escalation_state, created_at)`
- `ModerationAction(id, target_type, target_id, moderator_id, action[warn|remove|suspend|ban], reason, created_at)`  // ADR-016
- `ChallengeProposal(id, author_id, draft_json, classifier_score, review_state, reviewer_id, created_at)`  // Phase 2 UGC (ADR-012)

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
- ~~**Trust & Safety**~~ — **decided (ADR-012…016):** curated-catalog-first + approval gate &
  dangerous-dare taxonomy; submission content screening (fail-closed); dares constrained to vetted
  challenges; age/minor defaults; reporting/escalation with staff SLAs. *Residual:* taxonomy
  contents, moderator-console UX, SLA targets.
- ~~**Economy**~~ — **decided (ADR-017…020):** non-cashable Score/Coins, prize-as-contest,
  bounty-first dare escrow, anti-inflation. *Residual:* exact reward curve, fee/cosmetic sinks.
- **Prize payout / KYC:** the platform-funded contest prize (ADR-017) still needs winner
  eligibility + KYC/anti-fraud at payout time.
- **Platform:** mobile-first (native?) vs web — affects on-device ML for Layer 0.
- **Monetization:** in-flows only (cosmetics, sponsored challenges, brand prize pools) — never
  cash-out (ADR-017).

---

## 8. Decision log

| Date | Change |
|------|--------|
| 2026-06-24 | Initial draft. Core insight + Problems #1–6 + ADR-001…008 + product model + backend sketch. |
| 2026-06-24 | Verification core locked: ADR-009 (reputation model), ADR-010 (jury engine + commit-reveal), ADR-011 (hybrid timing + optimistic pending + jury-to-play). Added §5.6–5.8 (flow walkthrough, timing model, parameters) and extended the §6.4 data model. |
| 2026-06-24 | Trust & Safety locked: ADR-012 (curated-catalog-first + approval gate + dangerous-dare taxonomy), ADR-013 (submission content screening), ADR-014 (dares constrained to vetted catalog), ADR-015 (age assurance & minor defaults), ADR-016 (reporting/escalation reusing jury+reputation). Added §5.9 (safety surfaces + challenge lifecycle); extended the §6.4 data model. |
| 2026-06-24 | Economy locked: ADR-017 (non-cashable currency + prize-as-contest gambling firewall), ADR-018 (Score vs Coins split), ADR-019 (bounty-first dare-stake escrow lifecycle), ADR-020 (anti-inflation/anti-farming). Added §5.10 (economy model) + §5.1 currency refinement; extended the data model (ledger `currency`, Dare escrow fields, EscrowHold). |
