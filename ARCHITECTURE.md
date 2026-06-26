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
│  drop-season4-ui         │   GET  /api/feed           │  minimal API + EF Core      │
│  - 5 tabs (Feed/Live/    │   POST /api/drops/{id}/vote│        │                     │
│    Ranks/Me/Post)        │   GET  /api/season/current │        ▼                     │
│  - app/lib/api.ts client │   GET  /api/leaderboard    │  ┌──────────────┐           │
│  - mock data = fallback  │   GET  /api/me             │  │ SQLite        │           │
│                          │   GET  /api/live           │  │ backend/dare.db│          │
│                          │   POST /api/dares          │  └──────────────┘           │
└──────────────────────────┘  ◀───────────────────────  └────────────────────────────┘
        React 19                    CORS allows :3000              Users · Drops · Votes
        Tailwind v4                                                Ledger · Season · Live
```

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
| **Feed** | ✅ persisted | Loads drops from `/api/feed`; each card's pool contribution = `votes × 3 Coins`. |
| **Vote (PASS/FAIL)** | ✅ persisted | `POST /api/drops/{id}/vote` records the vote, credits the voter 3 Coins, bumps the drop's count. **One vote per user/drop** (idempotent). Survives reload. |
| **Post a dare** | ✅ persisted | The 4-step sheet `POST /api/dares`; the new dare appears at the **top of the feed** and persists across reload; your challenge count increments. |
| **Ranks / Season** | ✅ persisted | `/api/season/current` (pool, days-left, 30/50/20 split) + `/api/leaderboard` (top 10, "You" flagged). Reflects your live votes/posts. |
| **Profile (Me)** | ✅ persisted | `/api/me` — earnings total, votes given, challenges, city rank update live. |
| **Live arena** | 🟡 seeded | Loads 3 performers from `/api/live`; the tallies/timers/viewers animate **client-side only**. |
| **Prize-pool ticker** | 🟡 cosmetic | The headline number ticks up via a client timer for "live" feel (on top of the real seeded value). |

---

## 3. Backend in detail (`backend/Program.cs`)

A single file: constants → DI/CORS → DB seed → endpoints → DTOs → palette → entities → seed data.

### 3.1 Data model

EF Core entities, persisted in SQLite. Amounts are non-cashable **Coins** — whole integers
(`long`), so SQLite `SUM()` is exact and there are no floats in the database. *(1 vote = 3 Coins;
DESIGN.md ADR-017/021 — the economy is a platform-funded contest, never cash.)*

| Entity | Key fields | Notes |
|---|---|---|
| `User` | `Id`, `Handle`, `Name`, `City`, `Initials`, `PlayerNo`, `Rep`, `Streak`, `Points`, `CoinsBalance`, `VotesGiven`, `Challenges`, `PoolShare`, `IsDemo` | `Id` is **caller-assigned** (`ValueGeneratedNever`) so the seeded leaderboard order is deterministic. Demo user = `Id 1`. |
| `Drop` | `Id`, `PlayerNo`, `Title`, `Username`, `City`, `Category`, `ColorKey`, `Duration`, `Views`, `Verified`, `Trending`, `Tall`, `PassVotes`, `FailVotes`, `Pts`, `CreatorUserId`, `CreatedAt` | A feed item. `votes = PassVotes + FailVotes`. `ColorKey` ∈ {wall, teal, door, gold} maps to the glass palette. |
| `Vote` | `Id`, `DropId`, `VoterUserId`, `Verdict`, `CreatedAt` | **Unique index on `(DropId, VoterUserId)`** enforces one vote per user/drop. |
| `LedgerEntry` | `Id`, `UserId`, `Currency` (`earnings`\|`score`\|`rep`), `Amount` (long), `Reason`, `Status`, `CreatedAt` | **Append-only** (a balance is the sum of `Amount`). Mirrors DESIGN.md ADR-006/018. |
| `Season` | `Id`, `Number`, `StartsAt`, `EndsAt`, `PrizePoolCoins` | One row (Season 4). `daysLeft` is derived from `EndsAt`. |
| `LiveSession` | `Id`, `PlayerNo`, `Initials`, `Name`, `City`, `SeasonRank`, `Challenge`, `EndsInSeconds`, `Viewers`, `PassVotes`, `FailVotes`, `ColorKey` | Seeded live-arena performers. |

`DareDb` registers all six as `DbSet`s. The schema is created with `EnsureCreated()` (no
migrations) — **changing an entity means deleting `dare.db` so it re-creates**.

### 3.2 Endpoints

| Method | Route | Logic |
|---|---|---|
| GET | `/api/feed` | All drops, newest first (`CreatedAt desc`), projected to the UI card shape (incl. palette colors + derived `poolContrib`). |
| POST | `/api/drops/{id}/vote` | Body `{verdict:"pass"\|"fail"}`. Validates verdict (else **400**) and drop (else **404**). If the user hasn't voted: append a `Vote`, bump `PassVotes`/`FailVotes`, `VotesGiven++`, credit `CoinsBalance += 3` Coins (+ ledger), grow the pool. Returns updated tallies + `alreadyVoted`. Re-voting is a no-op (`alreadyVoted:true`, `earned:0`). |
| GET | `/api/season/current` | `number`, `daysLeft` (ceil of `EndsAt − now`), `prizePool`, and `splits` = pool × {0.30 voters, 0.50 creators, 0.20 platform}. |
| GET | `/api/leaderboard` | Top 10 users by `Points` desc; `rank` from order; `isMe` flags the demo user. |
| GET | `/api/me` | Demo profile: identity, `cityRank` (computed from the leaderboard order), and an earnings breakdown (`votesCast` is live = `VotesGiven × 3 Coins`; other lines are seeded constants). |
| GET | `/api/live` | Seeded `LiveSession`s projected with palette colors. |
| POST | `/api/dares` | Body `{challenge, category, difficulty, timeLimit, bounty, isPublic}`. Validates `challenge` length (≥ 8, else **400**). Creates a `Drop` authored by the demo user (`CreatedAt = now` → top of feed), `Challenges++`, appends a `rep` ledger entry. Returns the new card. `difficulty` → points (easy 30 / medium 80 / hard 200); `category` → color. |

### 3.3 Cross-cutting conventions

- **Whole Coins** everywhere money is stored (`long`, non-cashable; 1 vote = 3 Coins). No
  fractional currency and no `$` — see DESIGN.md ADR-017/021.
- **Append-only ledger** — earnings/score/rep are events, never mutated in place.
- **Idempotent voting** — DB unique index + an existence check.
- **Server-owned palette** — the UI's glass colors come from the API (`ColorKey` → `GlassColor`), so
  the backend is the single source of truth even for styling tokens.
- **CORS** is open to `http://localhost:3000` only.
- **`public partial class Program {}`** + `InternalsVisibleTo("DareApi.Tests")` exist solely to let
  the test project host the app and swap the database.

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
| `DareFeed.tsx` | `GET /api/feed`, `GET /api/season/current` | `POST /api/drops/{id}/vote` (optimistic; updates the card's count on success) |
| `SeasonBoard.tsx` | `GET /api/season/current`, `GET /api/leaderboard` | — |
| `ProfileCard.tsx` | `GET /api/me` | — |
| `LiveArena.tsx` | `GET /api/live` | — (client animates the rest) |
| `PostDareSheet.tsx` | — | `POST /api/dares` on "Launch" |
| `page.tsx` | — | Holds `feedKey`; after a post, `onPosted` bumps it + switches to the Feed tab so `DareFeed` refetches and shows the new dare. |

---

## 5. What's real vs seeded vs cosmetic vs stubbed

This is the most important thing to understand before building on it.

- **Real & persisted (survives reload):** the feed list, drop vote counts, the demo user's earnings
  ledger + votes-given, posted dares, the demo user's challenge count.
- **Seeded (in the DB, but static — not derived live):** the 9 NPC leaderboard players' stats, the
  live-arena performers, the season pool's base value & end date, and several profile lines
  (`poolShare`, `challengesCreated`, `watchCredit`, `creatorsHelped`, the 3 badges).
- **Cosmetic / client-only:** the prize-pool "ticking up" animation, and the live-arena per-second
  vote tallies / countdown timers / viewer counts.
- **Stubbed (designed in `DESIGN.md`, not built):** auth (single demo user), video upload (a drop is
  claim-only), the verification jury / commit-reveal / ML (votes apply directly), Coins staking /
  dare-stake escrow, and real-time transport (no WebSocket — polling/animation only).

---

## 6. Tests (`backend.Tests/`)

11 xUnit integration tests over the real HTTP surface, each against an **isolated in-memory SQLite**
database (`TestApiFactory` swaps the connection via `WebApplicationFactory`). They cover the feed,
the vote loop **and its failure paths** (invalid verdict → 400, unknown drop → 404, double-vote
idempotency), the season split, leaderboard ordering, the profile, and posting a dare (incl.
too-short challenge → 400).

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
- **The pool accounting is a demo artifact.** Each vote both *credits* the voter 3 Coins **and**
  *mints* 3 Coins into the pool (in the vote handler) — there's no modeled revenue inflow. A real
  pool is funded from sponsors/cosmetics/brand pools (DESIGN.md §5.10), not from votes.
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
