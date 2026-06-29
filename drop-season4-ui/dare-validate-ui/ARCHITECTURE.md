# Drop — High-Level Architecture

> **Drop** is a mobile-first dare platform. Users discover dares, accept them, record proof, and submit it. An AI pre-screens each submission, then a live crowd vote can override the AI verdict. Every 30 days is a Season — the prize pool is shared 30% voters / 50% creators / 20% platform (everyone who participates earns, not just the top 10).
>
> User-facing brand: **DARE** · Internal code term for a submission: **drop**

> **Implementation status (Season 4 — as built):** the backend now implements this architecture —
> the verification engine (AI pre-screen → 60s crowd override), the `Dare`/`Drop` split, the
> accept → proof → forfeit flow, and the entry-fee prize pool. Routes are served under `/api`
> (e.g. `/api/drops`, `/api/seasons/current`, `/api/users/me`). See `../../backend/README.md` and the
> as-built `../../ARCHITECTURE.md`. The staked jury (DESIGN.md ADR-001/009/010) remains the Phase-2
> target; the shipped AI + crowd-override model is recorded as DESIGN.md ADR-022 (pool funding as
> ADR-023, accept/forfeit as ADR-024).

---

## The Five Layers

```
┌─────────────────────────────────────────────────────────┐
│  ENTRY EXPERIENCE                                       │
│  Dare Feed (no signup) · Live Arena · Leaderboard       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  CORE LOOP                                              │
│  Discover → Accept → Verify → Rank                      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  VERIFICATION ENGINE  (the moat)                        │
│  AI pre-screen → Live crowd vote → Human override       │
│  Narrative: "Humans vs The Machine"                     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  SOCIAL + RETENTION LAYER                               │
│  Seasons (30-day arcs) · Reputation · FOMO timers       │
│  Follow graph · Streak visibility                       │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  REVENUE MODEL                                          │
│  Season prize pool · 30% voters / 50% creators / 20% platform │
│  Entry fees (ranked dares) · Brand dares (native)       │
└─────────────────────────────────────────────────────────┘
```

---

## The Core Loop — Step by Step

```
1. DISCOVER
   User opens Feed tab → sees verified drop cards with proof video thumbnails
   Each card shows: title · username · city · vote count · rep reward
   Inline Pass / Fail vote buttons → user participates without committing

2. ACCEPT
   User sees "Open Dares" section → dare cards with expiry countdowns
   Taps "Accept Dare →" → full-screen modal appears
   Modal starts a 20-minute deadline countdown
   User must submit proof before deadline or it counts as forfeit

3. VERIFY
   User submits proof (video / photo)
   AI pre-screens: returns { verdict, confidence (0–1), reason }
   If confidence > 0.85 → auto-verified or auto-rejected
   Otherwise → status = "voting", 60-second window opens
   Community votes Pass / Fail in real time
   If pass_votes / total ≥ 60% → human override wins → verified
   If not → AI verdict stands → rejected

4. RANK
   Verified drop → rep points awarded to user
   Points accumulate on Season leaderboard
   Season prize pool pays out 30% voters / 50% creators / 20% platform (everyone earns, not just top 10)
   Season resets every 30 days → new narrative arc begins
```

---

## Screen Map (Frontend → Backend)

| Screen | Tab | What it shows | Key API calls |
|---|---|---|---|
| **Feed** | Feed | Verified drop cards, inline voting, season strip | `GET /drops` `POST /drops/:id/vote` |
| **Live Arena** | Live | Active performers mid-dare, live vote tallies, viewer counts | `GET /live` `POST /live/:id/vote` |
| **Ranks / Season** | Ranks | Season countdown, live prize pool, leaderboard top 10, your rank | `GET /seasons/current` `GET /seasons/:id/leaderboard` |
| **Profile** | Me | Rep, streak, city rank, badges, task history | `GET /users/me` |
| **Post Drop sheet** | FAB (+) | Compose dare → upload proof → AI verdict → result | `POST /drops` |
| **Accept Modal** | (inline) | 20-min countdown after accepting a dare | `POST /dares/:id/accept` |

---

## Data Model (flat reference)

```
User          id · username · city · rep_points · streak · specialization
Dare          id · title · category · difficulty · rep_reward · expires_at · is_brand_dare
Drop          id · dare_id · user_id · proof_url · status · ai_confidence · pass_votes · fail_votes · voting_ends_at · rep_awarded
Vote          id · drop_id · voter_user_id · verdict (pass|fail)
LiveSession   id · user_id · dare_id · viewer_count · pass_votes · fail_votes · ends_at · status
Season        id · number · starts_at · ends_at · prize_pool_cents · status
SeasonRank    season_id · user_id · points · rank · prize_share_cents
```

**Drop status machine:**
```
pending → ai_rejected → voting → verified
                    ↘           ↘ rejected
                     → verified (auto, high confidence)
```

---

## Real-Time Requirements

| Feature | Frequency | Method |
|---|---|---|
| Live vote counts (drops) | Per vote, ~1–5/sec | WebSocket / SSE |
| Live viewer count | Every 2–3s | WebSocket |
| Prize pool counter | Every 2–3s | Polling acceptable |
| New drops in feed | Every 4s | Polling acceptable |
| Voting window countdown | Client-side, seeded from server | None |

---

## The Flywheel (why the business compounds)

```
More players
    → more drops submitted
        → more spectators watching live
            → more votes cast
                → better / faster verification
                    → more legitimate prize pool
                        → attracts serious players
                            → more players
```

Each layer feeds the next. Verification quality is the lever — the crowd IS the product.

---

## Frontend Component Map

```
app/
├── page.tsx                  Shell · tab router · PostDareSheet trigger
├── layout.tsx                Mobile viewport meta · title "Drop"
├── globals.css               Design tokens · animations · sheet/overlay classes
└── components/
    ├── NavBar.tsx            5-tab nav (Feed·Live·[FAB]·Ranks·Me) · sticky bottom
    ├── DareFeed.tsx          Feed tab · drop cards · inline Pass/Fail voting · season strip
    ├── LiveArena.tsx         Live tab · performer cards · viewer count · live vote bar
    ├── SeasonBoard.tsx       Ranks tab · season countdown · live prize pool · leaderboard
    ├── ProfileCard.tsx       Me tab · rep · streak · badges · task history
    ├── PostDareSheet.tsx     Bottom sheet · compose → upload → AI verdict → result
    ├── AcceptDareModal.tsx   Full-screen overlay · 20:00 countdown · recording CTA
    ├── LiveFeed.tsx          Recent drops stream (used inside DareFeed)
    └── VerifyArena.tsx       Standalone verify UI (humans vs AI vote interface)
```

**Design tokens:**
```
--accent:    #ff3d6e   primary / urgent / AI villain
--accent-2:  #7c3aed   ranked / identity / season
--accent-3:  #06b6d4   verify arena / live
--surface:   #12121e   card backgrounds
--background:#080810   page background
```

---

## Key Product Decisions to Carry Into Backend

1. **Verification is the moat.** The 60% crowd override threshold is a product decision, not a technical one — make it configurable per dare type.
2. **Seasons are the heartbeat.** Every piece of gamification (rep, rank, prize) resets every 30 days. Design the DB with season_id as a first-class FK on ranks/points.
3. **Revenue share is the movement.** The prize pool is split **30% voters / 50% creators / 20% platform** (80% back to players) and surfaced in real time — not just at season end.
4. **Dare expiry creates FOMO.** Open dares have `expires_at`. The 20-minute accept window is a hard deadline — forfeits are recorded on the user's public profile.
5. **Forfeit is on the record.** A user who backs out of an accepted dare gets a public forfeit mark. This is a product trust signal — surface it in the profile history.
6. **Brand dares are native.** A brand can sponsor a dare (e.g. "Do X challenge wearing Y brand"). It's a `Dare` with `is_brand_dare=true` and `sponsor_id`. Not an ad banner — it flows through the same core loop.

---

## Suggested Backend Stack (to decide, not mandated)

| Concern | Suggestion | Why |
|---|---|---|
| Database | PostgreSQL | Relational — seasons/ranks/votes are joins, not documents |
| Real-time | Supabase Realtime or Ably | Vote ticking needs pub/sub, not polling |
| Media storage | Cloudflare R2 or S3 | Proof videos can be large; CDN delivery needed |
| AI pre-screen | Claude API (vision) or GPT-4o | Pass dare title + proof frame → `{ verdict, confidence, reason }` |
| Auth | JWT + refresh tokens | Standard; add social login (Google/Apple) for mobile |
| API style | REST for CRUD, WebSocket for live | Keeps it simple; upgrade to GraphQL subscriptions if needed |

---

*Frontend repo: `/Users/supriyakumari/Documents/personal/dare/dare-validate-ui`*
*Last updated: Season 4 UI complete — Feed, Live, Ranks, Profile, Post Drop flow*
