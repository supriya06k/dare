using Microsoft.EntityFrameworkCore;

// ── Drop — Season 4 backend (verification engine) ─────────────────────────────
// Core loop per drop-season4-ui/ARCHITECTURE.md: Discover → Accept → Verify → Rank.
// A **Dare** is an open challenge; a **Drop** is a proof submission against it that
// flows through the verification engine:
//     AI pre-screen  →  (auto-verify | auto-reject | crowd vote with human override)
// High AI confidence (> 0.85) auto-resolves; otherwise a 60s crowd window opens and
// ≥ 60% PASS overrides the machine to "verified" (else the AI verdict stands → rejected).
// The season prize pool is funded by **ranked-dare entry fees** (not vote-minting).
// Amounts are non-cashable **Coins** (whole integers; 1 vote = 3) — never cash.
// Time comes from an injected TimeProvider and the AI from an injected IProofScreener
// so the windows/verdicts are deterministic in tests. Auth/video/real ML stay stubbed.

const int DemoUserId = 1;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5099");
builder.Services.AddDbContext<DareDb>(o => o.UseSqlite("Data Source=dare.db"));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IProofScreener, StubProofScreener>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:3000", "http://127.0.0.1:3000")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

// ── DB init + seed ────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DareDb>();
    var clock = scope.ServiceProvider.GetRequiredService<TimeProvider>();
    db.Database.EnsureCreated();
    Seed.Run(db, clock.GetUtcNow());
}

// ── Helpers ───────────────────────────────────────────────────────────────────
static object Card(Drop d, Dare dare)
{
    var c = Palette.Get(dare.ColorKey);
    var votes = d.PassVotes + d.FailVotes;
    return new
    {
        id = d.Id,
        dareId = d.DareId,
        playerNo = d.PlayerNo,
        title = dare.Title,
        user = d.Username,
        city = d.City,
        votes,
        pts = dare.RepReward,
        duration = d.Duration,
        views = d.Views,
        status = d.Status,
        verified = d.Status == DropStatus.Verified,
        trending = d.Trending,
        category = dare.Category,
        aiConfidence = d.AiConfidence,
        votingEndsAt = d.VotingEndsAt,
        glTop = c.GlTop,
        glMid = c.GlMid,
        glBot = c.GlBot,
        border = c.Border,
        hi = c.Hi,
        deep = c.Deep,
        poolContrib = votes * Econ.VoteEarnCoins,
        tall = d.Tall,
    };
}

static object OpenDare(Dare da, DateTimeOffset now)
{
    var c = Palette.Get(da.ColorKey);
    return new
    {
        id = da.Id,
        title = da.Title,
        category = da.Category,
        difficulty = da.Difficulty,
        repReward = da.RepReward,
        entryFee = da.EntryFeeCoins,
        isRanked = da.IsRanked,
        isBrandDare = da.IsBrandDare,
        expiresInSeconds = (int)Math.Max(0, (da.ExpiresAt - now).TotalSeconds),
        glTop = c.GlTop, glMid = c.GlMid, glBot = c.GlBot, border = c.Border, deep = c.Deep, hi = c.Hi,
    };
}

// A balance is the sum of its append-only ledger entries (ADR-006) — never a mutated field.
static long CoinsOf(DareDb db, int userId) =>
    db.Ledger.Where(l => l.UserId == userId && l.Currency == "coins").Sum(l => (long?)l.Amount) ?? 0;

// Mark a verified drop: award the creator their Score (rep reward) once, via the ledger.
static void Verify(DareDb db, Drop d, DateTimeOffset now)
{
    d.Status = DropStatus.Verified;
    var dare = db.Dares.Find(d.DareId);
    var rep = dare?.RepReward ?? 0;
    d.RepAwarded = rep;
    if (d.UserId is int uid && rep > 0)
    {
        var creator = db.Users.Find(uid);
        if (creator is not null)
        {
            creator.Points += rep;
            db.Ledger.Add(new LedgerEntry { UserId = uid, Currency = "score", Amount = rep, Reason = $"verified:{d.Id}", Status = "confirmed", CreatedAt = now });
        }
    }
}

// Close any voting windows whose timer has elapsed: ≥ 60% PASS overrides to verified,
// otherwise the AI verdict stands and the drop is rejected. (Lazy resolution — runs on read/vote.)
static void ResolveDue(DareDb db, DateTimeOffset now)
{
    // SQLite can't translate DateTimeOffset comparisons — materialize, then filter by time in memory.
    var due = db.Drops
        .Where(d => d.Status == DropStatus.Voting && d.VotingEndsAt != null)
        .AsEnumerable()
        .Where(d => d.VotingEndsAt <= now)
        .ToList();
    if (due.Count == 0) return;
    foreach (var d in due) ResolveOne(db, d, now);
    db.SaveChanges();
}

static void ResolveOne(DareDb db, Drop d, DateTimeOffset now)
{
    var total = d.PassVotes + d.FailVotes;
    var passShare = total > 0 ? (double)d.PassVotes / total : 0.0;
    if (passShare >= Econ.CrowdOverrideThreshold) Verify(db, d, now);
    else d.Status = DropStatus.Rejected;
}

// AI pre-screen → status machine. > 0.85 confidence auto-resolves; otherwise the crowd decides.
static void ApplyScreening(DareDb db, Drop d, Dare dare, IProofScreener screener, DateTimeOffset now)
{
    var verdict = screener.Screen(dare.Title, d.ProofUrl ?? "");
    d.AiConfidence = verdict.Confidence;
    if (verdict.Confidence > Econ.AiAutoThreshold)
    {
        if (verdict.Pass) Verify(db, d, now);
        else d.Status = DropStatus.AiRejected;
    }
    else
    {
        d.Status = DropStatus.Voting;
        d.VotingEndsAt = now.AddSeconds(Econ.VotingWindowSeconds);
    }
}

static string ColorKeyFor(string category) => category.ToLowerInvariant() switch
{
    "physical" => "wall",
    "speed" => "teal",
    "creative" => "door",
    "social" => "gold",
    _ => "teal",
};

static int RepForDifficulty(string? difficulty) => (difficulty ?? "").ToLowerInvariant() switch
{
    "easy" => 30,
    "medium" => 80,
    "hard" => 200,
    _ => 50,
};

static string Capitalize(string s) => string.IsNullOrEmpty(s) ? s : char.ToUpperInvariant(s[0]) + s[1..];

// ── Feed (verified + in-voting drops, newest first) ───────────────────────────
app.MapGet("/api/drops", (DareDb db, TimeProvider clock) =>
{
    ResolveDue(db, clock.GetUtcNow());
    return (from d in db.Drops
            join da in db.Dares on d.DareId equals da.Id
            where d.Status == DropStatus.Verified || d.Status == DropStatus.Voting
            select new { d, da })
        .AsEnumerable()
        .OrderByDescending(x => x.d.CreatedAt).ThenByDescending(x => x.d.Id)
        .Select(x => Card(x.d, x.da)).ToList();
});

// ── A single drop (status check; resolves a due voting window on read) ─────────
app.MapGet("/api/drops/{id:int}", (int id, DareDb db, TimeProvider clock) =>
{
    ResolveDue(db, clock.GetUtcNow());
    var d = db.Drops.Find(id);
    if (d is null) return Results.NotFound(new { error = "unknown drop" });
    var dare = db.Dares.Find(d.DareId)!;
    return Results.Ok(Card(d, dare));
});

// ── Open dares available to accept ────────────────────────────────────────────
app.MapGet("/api/dares", (DareDb db, TimeProvider clock) =>
{
    var now = clock.GetUtcNow();
    return db.Dares.Where(da => da.IsOpen)
        .AsEnumerable()
        .Where(da => da.ExpiresAt > now)
        .OrderBy(da => da.ExpiresAt)
        .Select(da => OpenDare(da, now)).ToList();
});

// ── Vote on a drop (PASS/FAIL) → voter earns 3 Coins (one vote per user/drop) ──
// During an open voting window the tally can trigger the human override on resolution.
app.MapPost("/api/drops/{id:int}/vote", (int id, VoteDto dto, DareDb db, TimeProvider clock) =>
{
    var verdict = (dto.Verdict ?? "").ToLowerInvariant();
    if (verdict != "pass" && verdict != "fail")
        return Results.BadRequest(new { error = "verdict must be 'pass' or 'fail'" });

    var now = clock.GetUtcNow();
    ResolveDue(db, now);

    var drop = db.Drops.Find(id);
    if (drop is null) return Results.NotFound(new { error = "unknown drop" });

    var me = db.Users.Find(DemoUserId)!;
    var existing = db.Votes.FirstOrDefault(v => v.DropId == id && v.VoterUserId == DemoUserId);

    if (existing is null)
    {
        db.Votes.Add(new Vote { DropId = id, VoterUserId = DemoUserId, Verdict = verdict, CreatedAt = now });
        if (verdict == "pass") drop.PassVotes++; else drop.FailVotes++;
        me.VotesGiven++;
        db.Ledger.Add(new LedgerEntry { UserId = DemoUserId, Currency = "coins", Amount = Econ.VoteEarnCoins, Reason = $"vote:{id}", Status = "confirmed", CreatedAt = now });

        // If this vote lands after the window already closed, settle now.
        if (drop.Status == DropStatus.Voting && drop.VotingEndsAt is not null && now >= drop.VotingEndsAt)
            ResolveOne(db, drop, now);

        db.SaveChanges();
    }

    var votes = drop.PassVotes + drop.FailVotes;
    return Results.Ok(new
    {
        dropId = id,
        verdict,
        alreadyVoted = existing is not null,
        votes,
        status = drop.Status,
        earned = existing is null ? Econ.VoteEarnCoins : 0,
        myEarnings = CoinsOf(db, DemoUserId),
        myVotes = me.VotesGiven,
        poolContrib = votes * Econ.VoteEarnCoins,
    });
});

// ── Compose a dare → creates the Dare + the creator's first proof submission ──
app.MapPost("/api/dares", (CreateDareDto dto, DareDb db, TimeProvider clock, IProofScreener screener) =>
{
    var title = (dto.Challenge ?? "").Trim();
    if (title.Length < 8) return Results.BadRequest(new { error = "challenge text too short" });

    var now = clock.GetUtcNow();
    var me = db.Users.Find(DemoUserId)!;
    var category = string.IsNullOrWhiteSpace(dto.Category) ? "social" : dto.Category.Trim();
    var rep = RepForDifficulty(dto.Difficulty);

    var dare = new Dare
    {
        Title = title,
        Category = Capitalize(category),
        Difficulty = string.IsNullOrWhiteSpace(dto.Difficulty) ? "medium" : dto.Difficulty.Trim().ToLowerInvariant(),
        RepReward = rep,
        ColorKey = ColorKeyFor(category),
        ExpiresAt = now.AddDays(7),
        IsBrandDare = false,
        IsRanked = false,
        EntryFeeCoins = 0,
        IsOpen = false,
        CreatedAt = now,
    };
    db.Dares.Add(dare);
    db.SaveChanges();

    var drop = new Drop
    {
        DareId = dare.Id,
        UserId = DemoUserId,
        PlayerNo = me.PlayerNo,
        Username = me.Handle,
        City = me.City,
        ProofUrl = string.IsNullOrWhiteSpace(dto.ProofUrl) ? "claim://demo" : dto.ProofUrl.Trim(),
        Status = DropStatus.Pending,
        Duration = "0:00",
        Views = "0",
        Verified = false,
        Trending = false,
        Tall = false,
        PassVotes = 0,
        FailVotes = 0,
        CreatedAt = now,
    };
    db.Drops.Add(drop);
    ApplyScreening(db, drop, dare, screener, now);

    me.Challenges++;
    db.Ledger.Add(new LedgerEntry { UserId = DemoUserId, Currency = "rep", Amount = rep, Reason = "dare:created", Status = "confirmed", CreatedAt = now });
    db.SaveChanges();

    return Results.Ok(Card(drop, dare));
});

// ── Accept an open dare → opens a 20-minute proof deadline ────────────────────
app.MapPost("/api/dares/{id:int}/accept", (int id, DareDb db, TimeProvider clock) =>
{
    var now = clock.GetUtcNow();
    var dare = db.Dares.Find(id);
    if (dare is null) return Results.NotFound(new { error = "unknown dare" });
    if (dare.ExpiresAt <= now) return Results.BadRequest(new { error = "dare has expired" });

    var me = db.Users.Find(DemoUserId)!;
    var drop = new Drop
    {
        DareId = id,
        UserId = DemoUserId,
        PlayerNo = me.PlayerNo,
        Username = me.Handle,
        City = me.City,
        ProofUrl = null,
        Status = DropStatus.Accepted,
        DeadlineAt = now.AddMinutes(Econ.AcceptDeadlineMinutes),
        Duration = "0:00",
        Views = "0",
        CreatedAt = now,
    };
    db.Drops.Add(drop);

    // Ranked entry fees fund the prize pool (a Coins sink for the player). ADR-020/§5.10.
    long entryFee = 0;
    if (dare.IsRanked && dare.EntryFeeCoins > 0)
    {
        entryFee = dare.EntryFeeCoins;
        db.Ledger.Add(new LedgerEntry { UserId = DemoUserId, Currency = "coins", Amount = -entryFee, Reason = $"entry:{id}", Status = "confirmed", CreatedAt = now });
        var ranked = db.Seasons.OrderByDescending(s => s.Number).First();
        ranked.PrizePoolCoins += entryFee;
    }
    db.SaveChanges();

    var season = db.Seasons.OrderByDescending(s => s.Number).First();
    return Results.Ok(new
    {
        dropId = drop.Id,
        dareId = id,
        status = drop.Status,
        deadlineAt = drop.DeadlineAt,
        secondsLeft = (int)Math.Max(0, (drop.DeadlineAt!.Value - now).TotalSeconds),
        entryFee,
        prizePool = season.PrizePoolCoins,
    });
});

// ── Submit proof for an accepted dare → AI pre-screen (or forfeit if past deadline) ─
app.MapPost("/api/drops/{id:int}/proof", (int id, SubmitProofDto dto, DareDb db, TimeProvider clock, IProofScreener screener) =>
{
    var now = clock.GetUtcNow();
    var drop = db.Drops.Find(id);
    if (drop is null) return Results.NotFound(new { error = "unknown drop" });
    if (drop.Status != DropStatus.Accepted) return Results.BadRequest(new { error = "drop is not awaiting proof" });

    var dare = db.Dares.Find(drop.DareId)!;

    if (drop.DeadlineAt is not null && now > drop.DeadlineAt)
    {
        drop.Status = DropStatus.Forfeited;
        if (drop.UserId is int fuid)
        {
            var u = db.Users.Find(fuid);
            if (u is not null) u.Forfeits++;
            db.Ledger.Add(new LedgerEntry { UserId = fuid, Currency = "forfeit", Amount = 0, Reason = $"forfeit:{drop.DareId}", Status = "confirmed", CreatedAt = now });
        }
        db.SaveChanges();
        return Results.Ok(new { dropId = drop.Id, status = drop.Status, forfeited = true });
    }

    drop.ProofUrl = string.IsNullOrWhiteSpace(dto.ProofUrl) ? "claim://demo" : dto.ProofUrl.Trim();
    ApplyScreening(db, drop, dare, screener, now);
    db.SaveChanges();

    return Results.Ok(Card(drop, dare));
});

// ── Season + prize pool ───────────────────────────────────────────────────────
app.MapGet("/api/seasons/current", (DareDb db, TimeProvider clock) =>
{
    var s = db.Seasons.OrderByDescending(x => x.Number).First();
    var pool = s.PrizePoolCoins;
    var daysLeft = Math.Max(0, (int)Math.Ceiling((s.EndsAt - clock.GetUtcNow()).TotalDays));
    return Results.Ok(new
    {
        id = s.Id,
        number = s.Number,
        daysLeft,
        prizePool = pool,
        splits = new
        {
            voters = (long)Math.Round(pool * 0.30),
            creators = (long)Math.Round(pool * 0.50),
            platform = (long)Math.Round(pool * 0.20),
        },
    });
});

// ── Leaderboard for a season (top 10 by points; demo user flagged) ────────────
app.MapGet("/api/seasons/{id:int}/leaderboard", (int id, DareDb db) =>
{
    var season = db.Seasons.OrderByDescending(x => x.Number).First();
    if (id != season.Number && id != season.Id) return Results.NotFound(new { error = "unknown season" });

    var coinsByUser = db.Ledger.Where(l => l.Currency == "coins")
        .GroupBy(l => l.UserId)
        .Select(g => new { UserId = g.Key, Sum = g.Sum(x => x.Amount) })
        .ToDictionary(x => x.UserId, x => x.Sum);

    var players = db.Users.OrderByDescending(u => u.Points).ThenBy(u => u.Id).Take(10).ToList();
    return Results.Ok(players.Select((u, i) => new
    {
        rank = i + 1,
        playerNo = u.PlayerNo,
        initials = u.Initials,
        name = u.Name,
        city = u.City,
        challenges = u.Challenges,
        points = u.Points,
        earnings = coinsByUser.GetValueOrDefault(u.Id, 0L),
        votes = u.VotesGiven,
        isMe = u.Id == DemoUserId,
    }).ToList());
});

// ── Demo user profile ─────────────────────────────────────────────────────────
app.MapGet("/api/users/me", (DareDb db, TimeProvider clock) =>
{
    var u = db.Users.Find(DemoUserId);
    if (u is null) return Results.NotFound();

    var ranked = db.Users.OrderByDescending(x => x.Points).ThenBy(x => x.Id).Select(x => x.Id).ToList();
    var rank = ranked.IndexOf(u.Id) + 1;
    var season = db.Seasons.OrderByDescending(s => s.Number).First();
    var daysLeft = Math.Max(0, (int)Math.Ceiling((season.EndsAt - clock.GetUtcNow()).TotalDays));
    var coins = CoinsOf(db, DemoUserId);
    var votesCast = u.VotesGiven * Econ.VoteEarnCoins;

    return Results.Ok(new
    {
        username = u.Handle,
        city = $"{u.City}, Hyderabad",
        rep = u.Rep,
        streak = u.Streak,
        cityRank = rank,
        playerNo = u.PlayerNo,
        completedTasks = u.Challenges,
        forfeits = u.Forfeits,
        badges = new[]
        {
            new { label = "Speed Demon",    icon = "⚡" },
            new { label = "AI Slayer",      icon = "🤖" },
            new { label = "Human Verified", icon = "✓" },
        },
        earnings = new
        {
            total = coins,
            challengesCreated = 2100,
            votesCast,
            watchCredit = 430,
            votesGiven = u.VotesGiven,
            challengesVerifiedByMe = u.VotesGiven,
            creatorsHelped = 54,
            payoutIn = daysLeft,
        },
        poolShare = u.PoolShare,
    });
});

// ── Live arena (seeded performers; client animates tallies/timers) ────────────
app.MapGet("/api/live", (DareDb db) =>
    db.LiveSessions.OrderBy(l => l.Id).AsEnumerable().Select(l =>
    {
        var c = Palette.Get(l.ColorKey);
        return new
        {
            id = l.Id,
            playerNo = l.PlayerNo,
            initials = l.Initials,
            name = l.Name,
            city = l.City,
            seasonRank = l.SeasonRank,
            challenge = l.Challenge,
            endsInSeconds = l.EndsInSeconds,
            viewers = l.Viewers,
            passVotes = l.PassVotes,
            failVotes = l.FailVotes,
            glTop = c.GlTop, glMid = c.GlMid, glBot = c.GlBot, border = c.Border, deep = c.Deep, hi = c.Hi,
        };
    }).ToList());

// ── Vote on a live performer → persists the tally + earns 3 Coins ─────────────
app.MapPost("/api/live/{id:int}/vote", (int id, VoteDto dto, DareDb db, TimeProvider clock) =>
{
    var verdict = (dto.Verdict ?? "").ToLowerInvariant();
    if (verdict != "pass" && verdict != "fail")
        return Results.BadRequest(new { error = "verdict must be 'pass' or 'fail'" });

    var session = db.LiveSessions.Find(id);
    if (session is null) return Results.NotFound(new { error = "unknown live session" });

    var me = db.Users.Find(DemoUserId)!;
    var now = clock.GetUtcNow();
    if (verdict == "pass") session.PassVotes++; else session.FailVotes++;
    me.VotesGiven++;
    db.Ledger.Add(new LedgerEntry { UserId = DemoUserId, Currency = "coins", Amount = Econ.VoteEarnCoins, Reason = $"live:{id}", Status = "confirmed", CreatedAt = now });
    db.SaveChanges();

    return Results.Ok(new
    {
        id,
        verdict,
        passVotes = session.PassVotes,
        failVotes = session.FailVotes,
        earned = Econ.VoteEarnCoins,
        myEarnings = CoinsOf(db, DemoUserId),
        myVotes = me.VotesGiven,
    });
});

app.Run();

// Exposes the implicit entry-point class to the test project (WebApplicationFactory<Program>).
public partial class Program { }

// ── DTOs ──────────────────────────────────────────────────────────────────────
record VoteDto(string Verdict);
record CreateDareDto(string Challenge, string Category, string Difficulty, string TimeLimit, string? Bounty, bool IsPublic, string? ProofUrl);
record SubmitProofDto(string? ProofUrl);

// ── Economy + verification constants (DESIGN.md ADR-017/021 + frontend ARCHITECTURE.md) ─
static class Econ
{
    public const long VoteEarnCoins = 3;            // non-cashable Coins paid to a voter per vote
    public const int VotingWindowSeconds = 60;      // crowd override window
    public const int AcceptDeadlineMinutes = 20;    // proof deadline after accepting a dare
    public const double AiAutoThreshold = 0.85;     // > this AI confidence auto-resolves
    public const double CrowdOverrideThreshold = 0.60; // ≥ this PASS share overrides the AI
}

// Drop lifecycle: pending → ai_rejected | verified (auto) | voting → verified | rejected.
// Accept branch: accepted → (proof) → pending… | forfeited (deadline missed).
static class DropStatus
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
    public const string Voting = "voting";
    public const string Verified = "verified";
    public const string Rejected = "rejected";
    public const string AiRejected = "ai_rejected";
    public const string Forfeited = "forfeited";
}

// ── AI pre-screen seam (stubbed; real ML designed in DESIGN.md, not built) ────
record ProofVerdict(bool Pass, double Confidence, string Reason);

interface IProofScreener
{
    ProofVerdict Screen(string title, string proofUrl);
}

// Deterministic stub: missing proof → confident reject; claim-only demo proofs are
// uncertain (routed to the crowd); anything else gets a stable pseudo-confidence.
sealed class StubProofScreener : IProofScreener
{
    public ProofVerdict Screen(string title, string proofUrl)
    {
        if (string.IsNullOrWhiteSpace(proofUrl))
            return new ProofVerdict(false, 0.92, "no proof attached");
        if (proofUrl.StartsWith("claim://", StringComparison.OrdinalIgnoreCase))
            return new ProofVerdict(true, 0.60, "claim-only proof — routed to the crowd");
        var confidence = 0.55 + StableHash($"{title}|{proofUrl}") % 1000 / 1000.0 * 0.44; // 0.55..0.99
        return new ProofVerdict(true, Math.Round(confidence, 2), "auto-screened");
    }

    // FNV-1a — stable across processes (string.GetHashCode is randomized per run).
    static uint StableHash(string s)
    {
        uint h = 2166136261;
        foreach (var c in s) { h ^= c; h *= 16777619; }
        return h;
    }
}

// ── Glass color palette (mirrors the Season 4 SEED colors) ────────────────────
record GlassColor(string GlTop, string GlMid, string GlBot, string Border, double Hi, string Deep);

static class Palette
{
    static readonly Dictionary<string, GlassColor> Map = new()
    {
        ["wall"] = new("rgba(245,140,160,0.98)", "rgba(232,80,106,0.97)", "rgba(122,18,48,1.0)", "rgba(255,155,175,0.72)", 0.42, "#7A1230"),
        ["teal"] = new("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", "rgba(100,230,220,0.72)", 0.45, "#0C5E57"),
        ["door"] = new("rgba(100,160,224,0.98)", "rgba(74,130,192,0.97)", "rgba(28,60,120,1.0)", "rgba(140,190,240,0.72)", 0.44, "#284E80"),
        ["gold"] = new("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", "rgba(255,235,150,0.85)", 0.55, "#B88820"),
    };
    public static GlassColor Get(string key) => Map.TryGetValue(key, out var c) ? c : Map["teal"];
}

// ── Entities ──────────────────────────────────────────────────────────────────
class User
{
    public int Id { get; set; }
    public string Handle { get; set; } = "";
    public string Name { get; set; } = "";
    public string City { get; set; } = "";
    public string Initials { get; set; } = "";
    public string PlayerNo { get; set; } = "";
    public int Rep { get; set; }
    public int Streak { get; set; }
    public int Points { get; set; }
    public int VotesGiven { get; set; }
    public int Challenges { get; set; }
    public int Forfeits { get; set; }
    public double PoolShare { get; set; }
}

// An open challenge a user can attempt. A Drop is a submission against one.
class Dare
{
    public int Id { get; set; }
    public string Title { get; set; } = "";
    public string Category { get; set; } = "";
    public string Difficulty { get; set; } = "medium";
    public int RepReward { get; set; }
    public string ColorKey { get; set; } = "teal";
    public DateTimeOffset ExpiresAt { get; set; }
    public bool IsBrandDare { get; set; }
    public int? SponsorId { get; set; }
    public long EntryFeeCoins { get; set; }
    public bool IsRanked { get; set; }
    public bool IsOpen { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

// A proof submission against a Dare, moving through the verification engine.
class Drop
{
    public int Id { get; set; }
    public int DareId { get; set; }
    public int? UserId { get; set; }          // null for seeded external creators (snapshot below)
    public string PlayerNo { get; set; } = ""; // author snapshot (display)
    public string Username { get; set; } = "";
    public string City { get; set; } = "";
    public string? ProofUrl { get; set; }
    public string Status { get; set; } = DropStatus.Pending;
    public double? AiConfidence { get; set; }
    public int PassVotes { get; set; }
    public int FailVotes { get; set; }
    public DateTimeOffset? VotingEndsAt { get; set; }
    public DateTimeOffset? DeadlineAt { get; set; }
    public int RepAwarded { get; set; }
    public string Duration { get; set; } = "0:00";
    public string Views { get; set; } = "0";
    public bool Verified { get; set; } // legacy flag (mirrors Status == verified); kept for projection compatibility
    public bool Trending { get; set; }
    public bool Tall { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

class Vote
{
    public int Id { get; set; }
    public int DropId { get; set; }
    public int VoterUserId { get; set; }
    public string Verdict { get; set; } = "pass"; // pass | fail
    public DateTimeOffset CreatedAt { get; set; }
}

class LedgerEntry // append-only (ADR-006)
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Currency { get; set; } = "coins"; // coins | score | rep | forfeit
    public long Amount { get; set; }
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "confirmed"; // pending | confirmed | void
    public DateTimeOffset CreatedAt { get; set; }
}

class Season
{
    public int Id { get; set; }
    public int Number { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public long PrizePoolCoins { get; set; }
}

class LiveSession
{
    public int Id { get; set; }
    public string PlayerNo { get; set; } = "";
    public string Initials { get; set; } = "";
    public string Name { get; set; } = "";
    public string City { get; set; } = "";
    public int SeasonRank { get; set; }
    public string Challenge { get; set; } = "";
    public int EndsInSeconds { get; set; }
    public int Viewers { get; set; }
    public int PassVotes { get; set; }
    public int FailVotes { get; set; }
    public string ColorKey { get; set; } = "teal";
}

class DareDb : DbContext
{
    public DareDb(DbContextOptions<DareDb> options) : base(options) { }
    public DbSet<User> Users => Set<User>();
    public DbSet<Dare> Dares => Set<Dare>();
    public DbSet<Drop> Drops => Set<Drop>();
    public DbSet<Vote> Votes => Set<Vote>();
    public DbSet<LedgerEntry> Ledger => Set<LedgerEntry>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<LiveSession> LiveSessions => Set<LiveSession>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<User>().Property(u => u.Id).ValueGeneratedNever();
        mb.Entity<Vote>().HasIndex(v => new { v.DropId, v.VoterUserId }).IsUnique();
    }
}

// ── Seed (reproduces the Season 4 mock from the DB) ───────────────────────────
static class Seed
{
    public static void Run(DareDb db, DateTimeOffset now)
    {
        if (db.Users.Any()) return;

        // Demo user (the "You" row) + 9 leaderboard NPCs (SeasonBoard order).
        db.Users.AddRange(
            new User { Id = 1,  Handle = "your_username", Name = "You",      City = "Kondapur",      Initials = "ME", PlayerNo = "412", Rep = 4820, Streak = 14, Points = 2140, VotesGiven = 612,  Challenges = 14, PoolShare = 0.0031 },
            new User { Id = 2,  Handle = "priya_r",       Name = "Priya R",  City = "Banjara Hills", Initials = "PR", PlayerNo = "001", Points = 4210, VotesGiven = 3840, Challenges = 34 },
            new User { Id = 3,  Handle = "vikram_m",      Name = "Vikram M", City = "Jubilee Hills", Initials = "VM", PlayerNo = "047", Points = 3880, VotesGiven = 3510, Challenges = 28 },
            new User { Id = 4,  Handle = "neha_j",        Name = "Neha J",   City = "Madhapur",      Initials = "NJ", PlayerNo = "096", Points = 3540, VotesGiven = 3100, Challenges = 22 },
            new User { Id = 5,  Handle = "rohit_k",       Name = "Rohit K",  City = "Gachibowli",    Initials = "RK", PlayerNo = "199", Points = 3120, VotesGiven = 2740, Challenges = 19 },
            new User { Id = 6,  Handle = "asha_s",        Name = "Asha S",   City = "Hitech City",   Initials = "AS", PlayerNo = "218", Points = 2870, VotesGiven = 2480, Challenges = 17 },
            new User { Id = 7,  Handle = "dev_m",         Name = "Dev M",    City = "Kukatpally",    Initials = "DM", PlayerNo = "301", Points = 2560, VotesGiven = 2240, Challenges = 16 },
            new User { Id = 8,  Handle = "sid_k",         Name = "Sid K",    City = "Gachibowli",    Initials = "SK", PlayerNo = "067", Points = 1990, VotesGiven = 1780, Challenges = 12 },
            new User { Id = 9,  Handle = "tara_n",        Name = "Tara N",   City = "Secunderabad",  Initials = "TN", PlayerNo = "388", Points = 1780, VotesGiven = 1540, Challenges = 11 },
            new User { Id = 10, Handle = "kiran_p",       Name = "Kiran P",  City = "Begumpet",      Initials = "KP", PlayerNo = "456", Points = 1520, VotesGiven = 1310, Challenges = 9 }
        );

        // Opening Coins balances as append-only ledger entries (a balance is their sum). ADR-006.
        void Opening(int userId, long balance) =>
            db.Ledger.Add(new LedgerEntry { UserId = userId, Currency = "coins", Amount = balance, Reason = "seed:opening", Status = "confirmed", CreatedAt = now });
        Opening(1, 4_370); Opening(2, 31_200); Opening(3, 28_900); Opening(4, 26_400); Opening(5, 23_100);
        Opening(6, 21_400); Opening(7, 19_100); Opening(8, 14_800); Opening(9, 13_200); Opening(10, 11_300);
        db.SaveChanges();

        // Feed = verified submissions against (closed) dares. PassVotes carries the seed total.
        void Seeded(string playerNo, string title, string user, string city, string cat, string color, string dur, string views, bool trending, bool tall, int votes, int rep, int order)
        {
            var dare = new Dare
            {
                Title = title, Category = cat, Difficulty = "medium", RepReward = rep, ColorKey = color,
                ExpiresAt = now.AddDays(-1), IsOpen = false, IsRanked = false, EntryFeeCoins = 0, IsBrandDare = false,
                CreatedAt = now.AddMinutes(-order),
            };
            db.Dares.Add(dare);
            db.SaveChanges();
            db.Drops.Add(new Drop
            {
                DareId = dare.Id, UserId = null, PlayerNo = playerNo, Username = user, City = city,
                ProofUrl = "claim://seed", Status = DropStatus.Verified, Verified = true, AiConfidence = 0.99,
                PassVotes = votes, FailVotes = 0, RepAwarded = rep, Duration = dur, Views = views,
                Trending = trending, Tall = tall, CreatedAt = now.AddMinutes(-order),
            });
        }

        Seeded("001", "Sang full song in a metro",    "riya_hyd", "Hyderabad", "Social",   "wall", "0:23", "10.7K", true,  true,  2100, 340, 1);
        Seeded("047", "Cold water bucket, 5°C",        "karan.b",  "Mumbai",    "Physical", "teal", "0:41", "64.4M", false, false, 890,  210, 2);
        Seeded("218", "50 pushups in a mall",          "leo_chen", "Tokyo",     "Physical", "door", "1:12", "53.9M", true,  false, 1440, 280, 3);
        Seeded("067", "Only Spanish in a restaurant",  "amara_b",  "Lagos",     "Social",   "gold", "0:58", "6.9M",  false, true,  632,  150, 4);
        Seeded("456", "Rubik's cube blindfolded",      "priya_s",  "Bangalore", "Speed",    "wall", "2:04", "3.2M",  true,  false, 3210, 450, 5);
        Seeded("199", "Hand signs only food order",    "sid_k",    "Delhi",     "Social",   "teal", "1:32", "21.3M", false, false, 1180, 200, 6);

        // Open dares available to accept (power the Accept flow; ranked ones carry an entry fee).
        db.Dares.AddRange(
            new Dare { Title = "Do 30 squats in a public park",       Category = "Physical", Difficulty = "medium", RepReward = 80,  ColorKey = "teal", ExpiresAt = now.AddHours(6),  IsOpen = true, IsRanked = true,  EntryFeeCoins = 50,  IsBrandDare = false, CreatedAt = now },
            new Dare { Title = "Compliment 5 strangers on camera",     Category = "Social",   Difficulty = "easy",   RepReward = 30,  ColorKey = "gold", ExpiresAt = now.AddHours(12), IsOpen = true, IsRanked = false, EntryFeeCoins = 0,   IsBrandDare = false, CreatedAt = now },
            new Dare { Title = "Sprint 100m under 15 seconds",         Category = "Speed",    Difficulty = "hard",   RepReward = 200, ColorKey = "door", ExpiresAt = now.AddHours(3),  IsOpen = true, IsRanked = true,  EntryFeeCoins = 120, IsBrandDare = true,  SponsorId = 1, CreatedAt = now }
        );

        // Live arena performers (LiveArena PERFORMERS).
        db.LiveSessions.AddRange(
            new LiveSession { PlayerNo = "067", Initials = "SR", Name = "Sana Rao", City = "Hyderabad", SeasonRank = 4,  Challenge = "Walk into a shop and ask to try on 10 things", EndsInSeconds = 252, Viewers = 412, PassVotes = 543, FailVotes = 271, ColorKey = "wall" },
            new LiveSession { PlayerNo = "199", Initials = "AK", Name = "Arjun K",  City = "Mumbai",    SeasonRank = 11, Challenge = "Order food only using hand signs",            EndsInSeconds = 104, Viewers = 88,  PassVotes = 90,  FailVotes = 86,  ColorKey = "teal" },
            new LiveSession { PlayerNo = "412", Initials = "LM", Name = "Lila M",   City = "Seoul",     SeasonRank = 7,  Challenge = "Get 5 strangers to do a group photo with you", EndsInSeconds = 388, Viewers = 231, PassVotes = 189, FailVotes = 44,  ColorKey = "door" }
        );

        // Season 4 — prize pool seeded in Coins (accumulated entry fees); ends in 12 days.
        db.Seasons.Add(new Season { Number = 4, StartsAt = now.AddDays(-18), EndsAt = now.AddDays(12), PrizePoolCoins = 14_847_000L });

        db.SaveChanges();
    }
}
