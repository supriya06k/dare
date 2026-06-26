# DareApi — Season 4 backend

The backend behind the **Season 4 UI** (`drop-season4-ui/dare-validate-ui`, Next.js). It serves the
feed, the vote-to-earn loop, the season prize pool, the leaderboard, the profile, and posting a
dare. Amounts are non-cashable **Coins** (whole integers; 1 vote = 3) so SQLite `SUM()` stays exact.
The hard parts are deliberately **stubbed** (no auth, no video, no jury/ML — see "Stubbed" below).

## Run

```powershell
# 1. backend (http://localhost:5099) — SQLite dare.db auto-seeds on first start
cd backend
dotnet run

# 2. frontend (http://localhost:3000) — calls the backend (CORS is allowed for :3000)
cd drop-season4-ui/dare-validate-ui
npm install
npm run dev
```

Open **http://localhost:3000**. The frontend's API base is `NEXT_PUBLIC_API_BASE`
(defaults to `http://localhost:5099`, see `.env.local`). Every component keeps its mock data as a
graceful fallback if the backend is offline.

To reset the demo: stop the server, delete `backend/dare.db*`, restart.

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET  | `/api/feed`                 | Feed cards (drops) — newest first |
| POST | `/api/drops/{id}/vote`      | `{ "verdict": "pass"\|"fail" }` → records the vote, voter earns 3 Coins (one vote per user/drop) |
| GET  | `/api/season/current`       | Season number, days left, prize pool, 30/50/20 split |
| GET  | `/api/leaderboard`          | Top 10 players by points (demo user flagged `isMe`) |
| GET  | `/api/me`                   | Demo user profile + earnings breakdown |
| GET  | `/api/live`                 | Live arena performers |
| POST | `/api/dares`                | `{ challenge, category, difficulty, timeLimit, bounty, isPublic }` → creates a dare, returns the feed card |

## Tests

```powershell
cd backend.Tests
dotnet test
```

Integration tests run against the real HTTP surface with an isolated in-memory SQLite database
(`TestApiFactory`): the feed, the vote loop and its failure paths (invalid verdict → 400, unknown
drop → 404, double-vote idempotency), the season pool, the leaderboard ordering, the profile, and
posting a dare.

## Maps to DESIGN.md

- **ADR-005** — Submission/vote state lives in the `Drops`/`Votes` tables.
- **ADR-006** — Append-only `Ledger` (a balance is the sum of `Amount`).
- **ADR-018** — Coins are tracked on the ledger (`coins` currency, whole integers).
- **ADR-020** — A dare's points reward is weighted by difficulty (easy 30 / medium 80 / hard 200).

## Stubbed (designed in DESIGN.md, not built here)

- **Auth** → a single demo user (`your_username`, id 1).
- **Video upload** → none; a drop is claim-only.
- **Verification jury / commit-reveal / ML (ADR-009/010/013)** → votes apply directly.
- **Real-time** → the live arena tallies/timers animate client-side.

## Stack

.NET 9 minimal API + EF Core + SQLite. DB is created via `EnsureCreated()` (no migrations in v0).
CORS is enabled for the Next.js dev origin (`http://localhost:3000`).
