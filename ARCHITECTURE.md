# Drop — System Architecture (as built)

> **What this is:** a working, end-to-end slice of **Drop / Season 4** — a crowd-verified dare
> platform. A Next.js mobile UI talks over HTTP/JSON to a .NET backend that persists everything in
> SQLite. You can open the app, vote on dares, post a dare, and watch the leaderboard, prize pool,
> and your profile update — and the changes survive a page reload.
>
> **Related docs:**
> - `DESIGN.md` — the product/backend **reasoning** (20+ ADRs: verification, trust & safety, economy). The "why".
> - `backend/README.md` — backend run + endpoint quick reference.
> - `drop-season4-ui/dare-validate-ui/ARCHITECTURE.md` + `STRATEGY.md` — the **frontend visual design** (the "Solid Glass Arena" look, components, animations).
> - This file — the **as-built system**: how the pieces fit, what's real, and how to run it.

---

## 1. The big picture

Two processes talk over HTTP. The browser only ever talks to the Next.js app and the .NET API;
the API owns the database.

```
┌──────────────────────────┐        HTTP / JSON         ┌────────────────────────────┐
│  Next.js UI  (port 3000) │  ───────────────────────▶  │  DareApi (.NET)  (port 5099)│
│  drop-season4-ui         │                            │  minimal API + EF Core      │
│  - 5 tabs (Feed/Live/    │   verification engine:     │        │                     │
│    Ranks/Me/Post)        │   AI pre-screen → crowd    │        ▼                     │
│  - app/lib/api.ts client │   override → verified       │  ┌──────────────┐           │
│  - mock data = fallback  │                            │  │ SQLite        │           │
│                          │   ◀─── plain JSON ────▶    │  │ backend/dare.db│          │
│                          │                            │  └──────────────┘           │
└──────────────────────────┘     CORS allows :3000      └────────────────────────────┘
        React 19                                          Users · Dares · Drops · Votes
        Tailwind v4                                        Ledger · Season · LiveSession
```

**Endpoints** (full list in §3.2): `GET/POST /api/drops`, `/api/drops/{id}/vote`,
`/api/drops/{id}/proof`, `GET/POST /api/dares`, `/api/dares/{id}/accept`, `/api/seasons/current`,
`/api/seasons/{id}/leaderboard`, `/api/users/me`, `GET/POST /api/live`.

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, a single client page with
  state-based tab routing. Each tab fetches from the API on mount and keeps its original mock data as
  a **graceful fallback** if the backend is down.
- **Backend:** one-file .NET 9 minimal API (`backend/Program.cs`) + EF Core + SQLite. No auth; a
  single demo user (`id 1`) represents "you".
- **Contract:** plain JSON. The API returns objects shaped **exactly** like the UI's view models
  (including the glass colors), so wiring was a data-source swap, not a redesign.

---

## 2. What works right now, and how to run it

### Run it (two terminals)

```powershell
# Terminal 1 — backend (http://localhost:5099). dare.db auto-creates + seeds on first run.
cd backend
dotnet run

# Terminal 2 — frontend (http://localhost:3000)
cd drop-season4-ui/dare-validate-ui
npm install      # first time only
npm run dev
```

Open **http://localhost:3000**. Reset the demo anytime: stop the backend, delete `backend/dare.db*`,
restart.

### What's working (verified end-to-end in a browser)

| Feature | Works? | What happens |
|---|---|---|
| **Feed** | ✅ persisted | Loads verified + in-voting drops from `/api/drops`; each card's pool contribution = `votes × 3 Coins` (server-computed), with a verification-status badge. |
| **Vote (PASS/FAIL)** | ✅ persisted | `POST /api/drops/{id}/vote` records the vote, credits the voter 3 Coins, bumps the count. **One vote per user/drop** (idempotent). In an open voting window the tally can trigger the crowd override. |
| **Verification engine** | ✅ persisted | Composed/submitted drops run an **AI pre-screen** → `verified`/`ai_rejected` (confidence > 0.85) or a **60s crowd window** → ≥60% PASS overrides to `verified`, else `rejected`. |
| **Compose a dare** | ✅ persisted | The 4-step sheet `POST /api/dares` creates a Dare + the creator's first submission, runs the pre-screen, and surfaces the AI verdict; it appears at the **top of the feed**. |
| **Accept → proof → forfeit** | ✅ persisted | `POST /api/dares/{id}/accept` opens a 20-min deadline (ranked dares charge an entry fee into the pool); `POST /api/drops/{id}/proof` submits proof (or forfeits past the deadline — recorded on your profile). |
| **Ranks / Season** | ✅ persisted | `/api/seasons/current` (pool, days-left, 30/50/20 split) + `/api/seasons/{id}/leaderboard` (top 10, "You" flagged). |
| **Profile (Me)** | ✅ persisted | `/api/users/me` — **ledger-summed** balance, votes given, challenges, forfeits, city rank. |
| **Live arena** | 🟡 seeded + votes persist | Loads 3 performers from `/api/live`; the tallies/timers animate **client-side**, but a PASS/FAIL now persists via `POST /api/live/{id}/vote` (earns Coins). |
| **Prize-pool ticker** | 🟡 cosmetic | The headline number ticks up via a client timer for "live" feel (on top of the real seeded + entry-fee value). |

---

## 3. Backend in detail (`backend/Program.cs`)

A single file: constants → DI/CORS → DB seed → endpoints → DTOs → palette → entities → seed data.

### 3.1 Data model

EF Core entities, persisted in SQLite. Amounts are non-cashable **Coins** — whole integers
(`long`), so SQLite `SUM()` is exact and there are no floats in the database. *(1 vote = 3 Coins;
DESIGN.md ADR-017/021 — the economy is a platform-funded contest, never cash.)*

| Entity | Key fields | Notes |
|---|---|---|
| `User` | `Id`, `Handle`, `Name`, `City`, `Initials`, `PlayerNo`, `Rep`, `Streak`, `Points`, `VotesGiven`, `Challenges`, `Forfeits`, `PoolShare` | `Id` is **caller-assigned** (`ValueGeneratedNever`); demo user = `Id 1`. The Coins **balance is not a field** — it's the sum of the user's `coins` ledger entries (ADR-006). |
| `Dare` | `Id`, `Title`, `Category`, `Difficulty`, `RepReward`, `ColorKey`, `ExpiresAt`, `IsBrandDare`, `SponsorId`, `EntryFeeCoins`, `IsRanked`, `IsOpen`, `CreatedAt` | An open challenge to attempt. `IsOpen` + future `ExpiresAt` = available to accept; ranked dares carry an `EntryFeeCoins` that funds the pool (ADR-023). |
| `Drop` | `Id`, `DareId`, `UserId?`, author snapshot (`PlayerNo`/`Username`/`City`), `ProofUrl?`, `Status`, `AiConfidence?`, `PassVotes`, `FailVotes`, `VotingEndsAt?`, `DeadlineAt?`, `RepAwarded`, `Duration`, `Views`, `Trending`, `Tall`, `CreatedAt` | A **proof submission** against a `Dare`. `Status` ∈ {pending, accepted, voting, verified, rejected, ai_rejected, forfeited}. Title/category/colors come from the `Dare`; `UserId` is null for seeded external creators. |
| `Vote` | `Id`, `DropId`, `VoterUserId`, `Verdict`, `CreatedAt` | **Unique index on `(DropId, VoterUserId)`** enforces one vote per user/drop. |
| `LedgerEntry` | `Id`, `UserId`, `Currency` (`coins`\|`score`\|`rep`\|`forfeit`), `Amount` (long), `Reason`, `Status`, `CreatedAt` | **Append-only** (a balance is the sum of `Amount`). Mirrors DESIGN.md ADR-006/018. |
| `Season` | `Id`, `Number`, `StartsAt`, `EndsAt`, `PrizePoolCoins` | One row (Season 4). Pool = seeded accumulated **entry fees**, grown as ranked dares are accepted. |
| `LiveSession` | `Id`, `PlayerNo`, `Initials`, `Name`, `City`, `SeasonRank`, `Challenge`, `EndsInSeconds`, `Viewers`, `PassVotes`, `FailVotes`, `ColorKey` | Seeded live-arena performers (votes persist). |

Timestamps are `DateTimeOffset`; `now` comes from an injected `TimeProvider` (real `TimeProvider.System`
in prod, a `FakeClock` in tests). The AI pre-screen is behind an injected `IProofScreener`
(`StubProofScreener` in prod, a forceable `FakeScreener` in tests).

`DareDb` registers all seven as `DbSet`s. The schema is created with `EnsureCreated()` (no
migrations) — **changing an entity means deleting `dare.db` so it re-creates**.

### 3.2 Endpoints

| Method | Route | Logic |
|---|---|---|
| GET | `/api/drops` | Verified + in-voting drops, newest first, joined to their `Dare` and projected to the UI card shape (incl. `status`, `aiConfidence`, palette colors, derived `poolContrib`). Resolves any due voting window on read. |
| GET | `/api/drops/{id}` | One drop (resolves a due voting window first). **404** if unknown. |
| POST | `/api/drops/{id}/vote` | Body `{verdict:"pass"\|"fail"}`. Validates verdict (**400**) and drop (**404**). First vote: append a `Vote`, bump tallies, `VotesGiven++`, credit 3 Coins (ledger). In an open window that has just closed, settle (≥60% PASS → `verified`, else `rejected`). Re-voting is a no-op (`alreadyVoted:true`, `earned:0`). |
| GET | `/api/dares` | Open, unexpired dares available to accept. |
| POST | `/api/dares` | Body `{challenge, category, difficulty, timeLimit, bounty, isPublic, proofUrl?}`. Validates `challenge` length (≥ 8, else **400**). Creates a `Dare` + the demo user's first `Drop`, runs the **AI pre-screen** (→ `verified`/`ai_rejected`/`voting`), `Challenges++`, appends a `rep` ledger entry. Returns the card with its `status`. |
| POST | `/api/dares/{id}/accept` | Creates a `Drop` in `accepted` with `DeadlineAt = now + 20m`. Ranked dares debit the entry fee (Coins sink) and add it to the season pool. **404** unknown, **400** expired. |
| POST | `/api/drops/{id}/proof` | Body `{proofUrl}`. For an `accepted` drop: in time → run the pre-screen; past `DeadlineAt` → `forfeited` (+ `Forfeits++`, ledger mark). **404** unknown, **400** if not awaiting proof. |
| GET | `/api/seasons/current` | `id`, `number`, `daysLeft` (ceil of `EndsAt − now`), `prizePool`, and `splits` = pool × {0.30 voters, 0.50 creators, 0.20 platform}. |
| GET | `/api/seasons/{id}/leaderboard` | Top 10 users by `Points` desc (earnings = ledger-summed Coins); `isMe` flags the demo user. **404** unknown season. |
| GET | `/api/users/me` | Demo profile: identity, `cityRank`, `forfeits`, and an earnings breakdown (`total` = ledger-summed Coins; other lines are seeded constants). |
| GET | `/api/live` | Seeded `LiveSession`s projected with palette colors. |
| POST | `/api/live/{id}/vote` | Body `{verdict}`. Persists the live tally + earns 3 Coins. **400** bad verdict, **404** unknown session. |

### 3.3 Cross-cutting conventions

- **Whole Coins** everywhere money is stored (`long`, non-cashable; 1 vote = 3 Coins). No
  fractional currency and no `$` — see DESIGN.md ADR-017/021.
- **Append-only ledger as the source of truth** — a Coins balance is the **sum** of its `coins`
  ledger entries (no mutated `CoinsBalance` field); earnings/score/rep/forfeit are events.
- **Verification status machine** — a `Drop` carries an explicit `Status`; resolution of voting
  windows is **lazy** (on read/vote — no background job in v0).
- **Entry-fee pool** — the season pool is funded by ranked-dare `EntryFeeCoins` on accept (ADR-023),
  **not** by votes; voters earn Coins that don't touch the pool.
- **Injected seams for determinism** — `TimeProvider` (the clock) and `IProofScreener` (the AI) are
  DI services, so the 60s window / 20-min deadline / AI verdict are deterministic in tests.
- **Idempotent voting** — DB unique index + an existence check.
- **Server-owned palette** — glass colors come from the API (`ColorKey` → `GlassColor`).
- **CORS** is open to `http://localhost:3000` only.
- **`public partial class Program {}`** + `InternalsVisibleTo("DareApi.Tests")` let the test project
  host the app and swap the database, clock, and screener.

---

## 4. Frontend wiring (`drop-season4-ui/dare-validate-ui`)

The UI was already built (mock data + state-based tabs). Wiring = swap each component's mock constant
for an API fetch, keeping the mock as a fallback.

- **`app/lib/api.ts`** — the only place that knows the backend exists. Exports `API_BASE`
  (`NEXT_PUBLIC_API_BASE` ?? `http://localhost:5099`), `apiGet`/`apiPost`, and the response types.
- **The fallback pattern (every tab):** `const [data, setData] = useState(MOCK)` → `useEffect`
  fetches and `setData(apiResult)` on success, swallows the error on failure. **If the backend is
  down, the screen still renders the mock — it never white-screens.**

| Component | Reads | Writes |
|---|---|---|
| `DareFeed.tsx` | `GET /api/drops`, `GET /api/seasons/current`, `GET /api/dares` (open dares) | `POST /api/drops/{id}/vote` (optimistic; uses server `poolContrib`) |
| `AcceptDareModal.tsx` | — | `POST /api/dares/{id}/accept`, then `POST /api/drops/{id}/proof` (shows the verdict) |
| `SeasonBoard.tsx` | `GET /api/seasons/current` → `GET /api/seasons/{number}/leaderboard` | — |
| `ProfileCard.tsx` | `GET /api/users/me` | — |
| `LiveArena.tsx` | `GET /api/live` | `POST /api/live/{id}/vote` |
| `PostDareSheet.tsx` | — | `POST /api/dares` on "Launch" (surfaces the AI verdict) |
| `page.tsx` | — | Holds `feedKey`; after a post, `onPosted` bumps it + switches to the Feed tab so `DareFeed` refetches. |

---

## 5. What's real vs seeded vs cosmetic vs stubbed

This is the most important thing to understand before building on it.

- **Real & persisted (survives reload):** the feed list, drop vote counts + verification `status`,
  the demo user's Coins ledger + votes-given, composed dares + their AI verdict, accepted dares /
  proof / forfeits, the entry-fee-funded pool, the demo user's challenge count.
- **Seeded (in the DB, but static — not derived live):** the 9 NPC leaderboard players' stats, the
  live-arena performers, the open dares, the season pool's base value & end date, and several profile
  lines (`poolShare`, `challengesCreated`, `watchCredit`, `creatorsHelped`, the 3 badges).
- **Cosmetic / client-only:** the prize-pool "ticking up" animation, and the live-arena per-second
  vote tallies / countdown timers / viewer counts.
- **Stubbed (designed in `DESIGN.md`, not built):** auth (single demo user); video upload (proof is a
  claim URL); **real ML + the staked jury / commit-reveal** (the AI is a deterministic
  `StubProofScreener` and the "crowd" is the single demo user — the threshold/override path is real);
  Coins staking / mutual-stake duels / escrow; and real-time transport (no WebSocket).

---

## 6. Tests (`backend.Tests/`)

21 xUnit integration tests over the real HTTP surface, each against an **isolated in-memory SQLite**
database, a controllable `FakeClock`, and a forceable `FakeScreener` (`TestApiFactory`). They cover
the feed, the vote loop **and its failure paths** (invalid verdict → 400, unknown drop → 404,
double-vote idempotency), the **verification engine** (AI auto-verify / auto-reject, and the 60s
crowd override → verified|rejected), the **accept → proof → forfeit** flow, the **entry-fee** pool,
the **ledger-summed** balance, the season split, leaderboard ordering, the profile, and composing a
dare (incl. too-short challenge → 400).

```powershell
cd backend.Tests
dotnet test
```

> Note: stop the running backend first — `dotnet test` rebuilds `DareApi` and can't overwrite a
> locked, running binary.

---

## 7. Key decisions & caveats

- **Economy is non-cashable Coins, not cash (DESIGN.md ADR-021).** Amounts are whole **Coins**
  (1 vote = 3) and a platform-funded contest — never real money (ADR-017's gambling /
  money-transmitter firewall stands). The UI and backend now express Coins throughout (no `$`).
- **The pool is funded by entry fees (DESIGN.md ADR-023).** Accepting a **ranked** dare debits the
  player's Coins (a sink) and credits the season pool by the dare's entry fee; the seeded pool
  represents accumulated fees. Votes reward the **voter** (3 Coins) and no longer mint into the pool
  (the earlier vote→pool minting demo artifact was removed). Payout stays a platform-funded contest.
- **Single demo user, no auth.** Everything "you" do is attributed to `id 1`.
- **No migrations.** Schema changes require deleting `dare.db`.
- **Prize-pool split is 30 / 50 / 20** (voters / creators / platform → 80% to players) — the
  canonical split across the backend, SeasonBoard, and `STRATEGY.md`. The earlier "30% to top 10"
  framing in the frontend `ARCHITECTURE.md` has been reconciled to match.

---

## 8. Where things live

```
dare/
├── DESIGN.md                         # product/backend reasoning — the ADRs (the "why")
├── ARCHITECTURE.md                   # ← this file (as-built system + how to run)
├── backend/
│   ├── Program.cs                    # the entire .NET API: model, endpoints, seed
│   ├── README.md                     # run + endpoint quick reference
│   └── dare.db                       # SQLite (git-ignored; auto-seeds)
├── backend.Tests/                    # xUnit integration tests (in-memory SQLite)
│   ├── TestApiFactory.cs
│   └── ApiTests.cs
└── drop-season4-ui/dare-validate-ui/ # the Next.js app
    ├── app/lib/api.ts                # API client + response types (the only backend coupling)
    ├── app/page.tsx                  # shell, tab router, post→refresh wiring
    └── app/components/               # DareFeed, SeasonBoard, ProfileCard, LiveArena, PostDareSheet, ...
```
