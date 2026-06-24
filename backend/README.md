# DareApi — v0 vertical slice

A thin, real, end-to-end slice of the Dare & Validate loop, backing the `option2.html`
prototype. Proves the architecture shape from `DESIGN.md`; the hard parts are deliberately
**stubbed** (no auth, no video, no jury/ML — see "Stubbed" below).

## Run

```powershell
cd backend
dotnet run
```

Then open **http://localhost:5099/** — `option2.html` is served same-origin and wired to the API.
The SQLite DB (`dare.db`) is created and seeded on first start.

Try the loop: hover-hold a sigil → "Accept the Dare" → tick the 3 checks + tap the vessel →
"Release Into the Network". The submission is created, stub-verified, and your Score appears on
the **Season Board** (🏆 hint, top-left).

## API

| Method | Route | Purpose |
|--------|-------|---------|
| GET  | `/api/challenges`             | List live challenges (seeded from the 6 dares) |
| GET  | `/api/me`                     | Demo user's Score + Coins (summed from the ledger) |
| POST | `/api/submissions`            | `{ "challengeId": n }` → submission (state `submitted`) |
| POST | `/api/submissions/{id}/verify`| Stub verify → `verified`; appends Score + Coins ledger entries |
| GET  | `/api/leaderboard`            | Top users by Score |

## Maps to DESIGN.md

- **ADR-005** — Submission state machine (`submitted → verified`).
- **ADR-006** — Append-only ledger (a balance is the sum of `delta`).
- **ADR-018** — Two currencies on the ledger: `score` (rank) + `coins` (wallet).
- **ADR-020** — Score is difficulty-weighted by the challenge's points.

## Stubbed (designed in DESIGN.md, not built here)

- **Auth** → a single demo user (`you`, id 1).
- **Video upload** → none; submission is claim-only.
- **Verification jury / commit-reveal / ML (ADR-009/010/013)** → a manual `verify` endpoint.
- **Coins staking / dares / Trust & Safety / anti-fraud** → out of v0 scope.

## Stack

.NET 9 minimal API + EF Core + SQLite. DB is created via `EnsureCreated()` (no migrations in v0).
