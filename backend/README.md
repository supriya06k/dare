# DareApi — Season 4 backend

The backend behind the **Season 4 UI** (`drop-season4-ui/dare-validate-ui`, Next.js). It serves the
feed, the vote-to-earn loop, the **verification engine** (AI pre-screen → 60s crowd override), the
accept → proof → forfeit flow, the season prize pool (funded by ranked-dare **entry fees**), the
leaderboard, and the profile. Amounts are non-cashable **Coins** (whole integers; 1 vote = 3) so
SQLite `SUM()` stays exact. Time comes from an injected `TimeProvider` and the AI from an injected
`IProofScreener` so the windows/verdicts are deterministic in tests. The truly hard parts (real
ML, the staked jury, auth, video) stay **stubbed** (see "Stubbed" below).

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
| GET  | `/api/drops`                  | Feed cards (verified + in-voting drops) — newest first |
| GET  | `/api/drops/{id}`             | One drop (resolves a due voting window on read) |
| POST | `/api/drops/{id}/vote`        | `{ "verdict": "pass"\|"fail" }` → records the vote, voter earns 3 Coins (one vote per user/drop); ≥ 60% PASS in an open window overrides the AI |
| GET  | `/api/dares`                  | Open dares available to accept |
| POST | `/api/dares`                  | `{ challenge, category, difficulty, timeLimit, bounty, isPublic, proofUrl? }` → composes a dare + the creator's first submission, runs the AI pre-screen, returns the feed card |
| POST | `/api/dares/{id}/accept`      | Accepts an open dare → opens a 20-minute proof deadline (ranked dares charge an entry fee into the pool) |
| POST | `/api/drops/{id}/proof`       | `{ proofUrl }` → submits proof for an accepted drop → AI pre-screen (or forfeit if past the deadline) |
| GET  | `/api/seasons/current`        | Season number, days left, prize pool, 30/50/20 split |
| GET  | `/api/seasons/{id}/leaderboard` | Top 10 players by points (demo user flagged `isMe`) |
| GET  | `/api/users/me`               | Demo user profile + ledger-summed balance + earnings breakdown |
| GET  | `/api/live`                   | Live arena performers |
| POST | `/api/live/{id}/vote`         | `{ "verdict": "pass"\|"fail" }` → persists the live tally + earns 3 Coins |

### Verification engine (Drop status machine)

```
submit → AI pre-screen → confidence > 0.85 ? (pass → verified | fail → ai_rejected)
                                            : voting (60s) → ≥60% PASS ? verified : rejected
accept → accepted (20-min deadline) → proof in time → AI pre-screen … | deadline missed → forfeited
```

## Tests

```powershell
cd backend.Tests
dotnet test
```

Integration tests (21) run against the real HTTP surface with an isolated in-memory SQLite database,
a controllable `FakeClock`, and a forceable `FakeScreener` (`TestApiFactory`): the feed, the vote
loop and its failure paths (invalid verdict → 400, unknown drop → 404, double-vote idempotency), the
**verification engine** (AI auto-verify / auto-reject, and the 60s crowd override → verified|rejected),
the **accept → proof → forfeit** flow, the **entry-fee** prize pool, the **ledger-summed** balance,
the season pool, the leaderboard ordering, the profile, and composing a dare.

## Maps to DESIGN.md

- **ADR-022** — Verification engine (Phase 1): AI pre-screen → 60s crowd override (supersedes ADR-001's jury for v0).
- **ADR-023** — Prize pool funded by ranked-dare **entry fees** (supersedes ADR-021's vote-minting demo artifact).
- **ADR-024** — Accept → 20-minute deadline → forfeit (the Phase-1 shape of ADR-019's stake lifecycle).
- **ADR-005** — Submission lifecycle is an explicit `status` machine on `Drops`.
- **ADR-006** — Append-only `Ledger`; a balance is the sum of its `coins` entries (`/api/users/me` sums it).
- **ADR-018** — Coins are tracked on the ledger (`coins` currency, whole integers).
- **ADR-020** — A dare's rep reward is weighted by difficulty (easy 30 / medium 80 / hard 200).

## Stubbed (designed in DESIGN.md, not built here)

- **Auth** → a single demo user (`your_username`, id 1).
- **Video upload** → none; proof is a claim URL (`IProofScreener` reads the URL, not real pixels).
- **Real ML + the staked jury / commit-reveal (ADR-009/010/013)** → the AI is a deterministic
  `StubProofScreener`; the "crowd" is the single demo user (the override threshold is real).
- **Real-time** → the live arena tallies/timers animate client-side; live votes persist on POST.

## Stack

.NET 9 minimal API + EF Core + SQLite. DB is created via `EnsureCreated()` (no migrations in v0).
CORS is enabled for the Next.js dev origin (`http://localhost:3000`).
