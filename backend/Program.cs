using Microsoft.EntityFrameworkCore;

// ── Drop — Season 4 backend ───────────────────────────────────────────────────
// Real, end-to-end loop behind the Season 4 UI: feed → vote (earn) → leaderboard,
// season prize pool, profile, and post-a-dare. Amounts are non-cashable **Coins**
// (whole integers) — never cash; the season prize is a platform-funded contest
// (DESIGN.md ADR-017/021). Maps to §6.4 + ADR-005/006/018/020.
// Auth/video/jury/ML remain stubbed.

const int DemoUserId = 1;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5099");
builder.Services.AddDbContext<DareDb>(o => o.UseSqlite("Data Source=dare.db"));
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
    db.Database.EnsureCreated();
    Seed.Run(db);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
static object Card(Drop d)
{
    var c = Palette.Get(d.ColorKey);
    var votes = d.PassVotes + d.FailVotes;
    return new
    {
        id = d.Id,
        playerNo = d.PlayerNo,
        title = d.Title,
        user = d.Username,
        city = d.City,
        votes,
        pts = d.Pts,
        duration = d.Duration,
        views = d.Views,
        verified = d.Verified,
        trending = d.Trending,
        category = d.Category,
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

// ── Feed ──────────────────────────────────────────────────────────────────────
app.MapGet("/api/feed", (DareDb db) =>
    db.Drops.OrderByDescending(d => d.CreatedAt).ThenByDescending(d => d.Id)
        .AsEnumerable().Select(Card).ToList());

// ── Vote on a drop (PASS/FAIL) → voter earns $0.003 (one vote per user/drop) ──
app.MapPost("/api/drops/{id:int}/vote", (int id, VoteDto dto, DareDb db) =>
{
    var verdict = (dto.Verdict ?? "").ToLowerInvariant();
    if (verdict != "pass" && verdict != "fail")
        return Results.BadRequest(new { error = "verdict must be 'pass' or 'fail'" });

    var drop = db.Drops.Find(id);
    if (drop is null) return Results.NotFound(new { error = "unknown drop" });

    var me = db.Users.Find(DemoUserId)!;
    var season = db.Seasons.OrderByDescending(s => s.Number).First();
    var existing = db.Votes.FirstOrDefault(v => v.DropId == id && v.VoterUserId == DemoUserId);

    if (existing is null)
    {
        db.Votes.Add(new Vote { DropId = id, VoterUserId = DemoUserId, Verdict = verdict, CreatedAt = DateTime.UtcNow });
        if (verdict == "pass") drop.PassVotes++; else drop.FailVotes++;
        me.VotesGiven++;
        me.CoinsBalance += Econ.VoteEarnCoins;
        db.Ledger.Add(new LedgerEntry { UserId = DemoUserId, Currency = "coins", Amount = Econ.VoteEarnCoins, Reason = $"vote:{id}", Status = "confirmed", CreatedAt = DateTime.UtcNow });
        season.PrizePoolCoins += Econ.VoteEarnCoins;  // every vote grows the live pool
        db.SaveChanges();
    }

    return Results.Ok(new
    {
        dropId = id,
        verdict,
        alreadyVoted = existing is not null,
        votes = drop.PassVotes + drop.FailVotes,
        earned = existing is null ? Econ.VoteEarnCoins : 0,
        myEarnings = me.CoinsBalance,
        myVotes = me.VotesGiven,
        prizePool = season.PrizePoolCoins,
    });
});

// ── Season + prize pool ───────────────────────────────────────────────────────
app.MapGet("/api/season/current", (DareDb db) =>
{
    var s = db.Seasons.OrderByDescending(x => x.Number).First();
    var pool = s.PrizePoolCoins;
    var daysLeft = Math.Max(0, (int)Math.Ceiling((s.EndsAt - DateTime.UtcNow).TotalDays));
    return Results.Ok(new
    {
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

// ── Leaderboard (top 10 by points; demo user flagged) ─────────────────────────
app.MapGet("/api/leaderboard", (DareDb db) =>
{
    var players = db.Users.OrderByDescending(u => u.Points).ThenBy(u => u.Id).Take(10).ToList();
    return players.Select((u, i) => new
    {
        rank = i + 1,
        playerNo = u.PlayerNo,
        initials = u.Initials,
        name = u.Name,
        city = u.City,
        challenges = u.Challenges,
        points = u.Points,
        earnings = u.CoinsBalance,
        votes = u.VotesGiven,
        isMe = u.Id == DemoUserId,
    }).ToList();
});

// ── Demo user profile ─────────────────────────────────────────────────────────
app.MapGet("/api/me", (DareDb db) =>
{
    var u = db.Users.Find(DemoUserId);
    if (u is null) return Results.NotFound();

    var ranked = db.Users.OrderByDescending(x => x.Points).ThenBy(x => x.Id).Select(x => x.Id).ToList();
    var rank = ranked.IndexOf(u.Id) + 1;
    var season = db.Seasons.OrderByDescending(s => s.Number).First();
    var daysLeft = Math.Max(0, (int)Math.Ceiling((season.EndsAt - DateTime.UtcNow).TotalDays));

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
        badges = new[]
        {
            new { label = "Speed Demon",    icon = "⚡" },
            new { label = "AI Slayer",      icon = "🤖" },
            new { label = "Human Verified", icon = "✓" },
        },
        earnings = new
        {
            total = u.CoinsBalance,
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
            glTop = c.GlTop,
            glMid = c.GlMid,
            glBot = c.GlBot,
            border = c.Border,
            deep = c.Deep,
            hi = c.Hi,
        };
    }).ToList());

// ── Post a dare → appears at the top of the feed ──────────────────────────────
app.MapPost("/api/dares", (DareDto dto, DareDb db) =>
{
    var title = (dto.Challenge ?? "").Trim();
    if (title.Length < 8) return Results.BadRequest(new { error = "challenge text too short" });

    var me = db.Users.Find(DemoUserId)!;
    var cat = string.IsNullOrWhiteSpace(dto.Category) ? "social" : dto.Category.Trim();
    var colorKey = cat.ToLowerInvariant() switch
    {
        "physical" => "wall",
        "speed" => "teal",
        "creative" => "door",
        "social" => "gold",
        _ => "teal",
    };
    var pts = (dto.Difficulty ?? "").ToLowerInvariant() switch
    {
        "easy" => 30,
        "medium" => 80,
        "hard" => 200,
        _ => 50,
    };

    var drop = new Drop
    {
        PlayerNo = me.PlayerNo,
        Title = title,
        Username = me.Handle,
        City = me.City,
        Category = char.ToUpper(cat[0]) + cat[1..],
        ColorKey = colorKey,
        Duration = "0:00",
        Views = "0",
        Verified = false,
        Trending = false,
        Tall = false,
        PassVotes = 0,
        FailVotes = 0,
        Pts = pts,
        CreatorUserId = DemoUserId,
        CreatedAt = DateTime.UtcNow,
    };
    db.Drops.Add(drop);
    me.Challenges++;
    db.Ledger.Add(new LedgerEntry { UserId = DemoUserId, Currency = "rep", Amount = pts, Reason = "dare:created", Status = "confirmed", CreatedAt = DateTime.UtcNow });
    db.SaveChanges();

    return Results.Ok(Card(drop));
});

app.Run();

// Exposes the implicit entry-point class to the test project (WebApplicationFactory<Program>).
public partial class Program { }

// ── DTOs ──────────────────────────────────────────────────────────────────────
record VoteDto(string Verdict);
record DareDto(string Challenge, string Category, string Difficulty, string TimeLimit, string? Bounty, bool IsPublic);

// ── Economy (DESIGN.md ADR-017/021): non-cashable Coins, never cash ───────────
static class Econ { public const long VoteEarnCoins = 3; }  // Coins paid to the voter per vote

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
    public long CoinsBalance { get; set; }
    public int VotesGiven { get; set; }
    public int Challenges { get; set; }
    public double PoolShare { get; set; }
    public bool IsDemo { get; set; }
}

class Drop
{
    public int Id { get; set; }
    public string PlayerNo { get; set; } = "";
    public string Title { get; set; } = "";
    public string Username { get; set; } = "";
    public string City { get; set; } = "";
    public string Category { get; set; } = "";
    public string ColorKey { get; set; } = "teal";
    public string Duration { get; set; } = "0:00";
    public string Views { get; set; } = "0";
    public bool Verified { get; set; }
    public bool Trending { get; set; }
    public bool Tall { get; set; }
    public int PassVotes { get; set; }
    public int FailVotes { get; set; }
    public int Pts { get; set; }
    public int? CreatorUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

class Vote
{
    public int Id { get; set; }
    public int DropId { get; set; }
    public int VoterUserId { get; set; }
    public string Verdict { get; set; } = "pass"; // pass | fail
    public DateTime CreatedAt { get; set; }
}

class LedgerEntry // append-only (ADR-006)
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Currency { get; set; } = "coins"; // coins | score | rep
    public long Amount { get; set; }
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "confirmed"; // pending | confirmed | void
    public DateTime CreatedAt { get; set; }
}

class Season
{
    public int Id { get; set; }
    public int Number { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
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
    public static void Run(DareDb db)
    {
        if (db.Users.Any()) return;
        var now = DateTime.UtcNow;

        // Demo user (the "You" row) + 9 leaderboard NPCs (SeasonBoard order).
        db.Users.AddRange(
            new User { Id = 1,  Handle = "your_username", Name = "You",      City = "Kondapur",      Initials = "ME", PlayerNo = "412", Rep = 4820, Streak = 14, Points = 2140, CoinsBalance = 4_370,  VotesGiven = 612,  Challenges = 14, PoolShare = 0.0031, IsDemo = true },
            new User { Id = 2,  Handle = "priya_r",       Name = "Priya R",  City = "Banjara Hills", Initials = "PR", PlayerNo = "001", Points = 4210, CoinsBalance = 31_200, VotesGiven = 3840, Challenges = 34 },
            new User { Id = 3,  Handle = "vikram_m",      Name = "Vikram M", City = "Jubilee Hills", Initials = "VM", PlayerNo = "047", Points = 3880, CoinsBalance = 28_900, VotesGiven = 3510, Challenges = 28 },
            new User { Id = 4,  Handle = "neha_j",        Name = "Neha J",   City = "Madhapur",      Initials = "NJ", PlayerNo = "096", Points = 3540, CoinsBalance = 26_400, VotesGiven = 3100, Challenges = 22 },
            new User { Id = 5,  Handle = "rohit_k",       Name = "Rohit K",  City = "Gachibowli",    Initials = "RK", PlayerNo = "199", Points = 3120, CoinsBalance = 23_100, VotesGiven = 2740, Challenges = 19 },
            new User { Id = 6,  Handle = "asha_s",        Name = "Asha S",   City = "Hitech City",   Initials = "AS", PlayerNo = "218", Points = 2870, CoinsBalance = 21_400, VotesGiven = 2480, Challenges = 17 },
            new User { Id = 7,  Handle = "dev_m",         Name = "Dev M",    City = "Kukatpally",    Initials = "DM", PlayerNo = "301", Points = 2560, CoinsBalance = 19_100, VotesGiven = 2240, Challenges = 16 },
            new User { Id = 8,  Handle = "sid_k",         Name = "Sid K",    City = "Gachibowli",    Initials = "SK", PlayerNo = "067", Points = 1990, CoinsBalance = 14_800, VotesGiven = 1780, Challenges = 12 },
            new User { Id = 9,  Handle = "tara_n",        Name = "Tara N",   City = "Secunderabad",  Initials = "TN", PlayerNo = "388", Points = 1780, CoinsBalance = 13_200, VotesGiven = 1540, Challenges = 11 },
            new User { Id = 10, Handle = "kiran_p",       Name = "Kiran P",  City = "Begumpet",      Initials = "KP", PlayerNo = "456", Points = 1520, CoinsBalance = 11_300, VotesGiven = 1310, Challenges = 9 }
        );

        // Feed drops (DareFeed SEED). PassVotes carries the seed total; FailVotes 0.
        void Drop(string playerNo, string title, string user, string city, string cat, string color, string dur, string views, bool verified, bool trending, bool tall, int votes, int pts, int order)
            => db.Drops.Add(new Drop
            {
                PlayerNo = playerNo, Title = title, Username = user, City = city, Category = cat, ColorKey = color,
                Duration = dur, Views = views, Verified = verified, Trending = trending, Tall = tall,
                PassVotes = votes, FailVotes = 0, Pts = pts, CreatedAt = now.AddMinutes(-order),
            });

        Drop("001", "Sang full song in a metro",    "riya_hyd", "Hyderabad", "Social",   "wall", "0:23", "10.7K", true,  true,  true,  2100, 340, 1);
        Drop("047", "Cold water bucket, 5°C",        "karan.b",  "Mumbai",    "Physical", "teal", "0:41", "64.4M", true,  false, false, 890,  210, 2);
        Drop("218", "50 pushups in a mall",          "leo_chen", "Tokyo",     "Physical", "door", "1:12", "53.9M", true,  true,  false, 1440, 280, 3);
        Drop("067", "Only Spanish in a restaurant",  "amara_b",  "Lagos",     "Social",   "gold", "0:58", "6.9M",  false, false, true,  632,  150, 4);
        Drop("456", "Rubik's cube blindfolded",      "priya_s",  "Bangalore", "Speed",    "wall", "2:04", "3.2M",  true,  true,  false, 3210, 450, 5);
        Drop("199", "Hand signs only food order",    "sid_k",    "Delhi",     "Social",   "teal", "1:32", "21.3M", true,  false, false, 1180, 200, 6);

        // Live arena performers (LiveArena PERFORMERS).
        db.LiveSessions.AddRange(
            new LiveSession { PlayerNo = "067", Initials = "SR", Name = "Sana Rao", City = "Hyderabad", SeasonRank = 4,  Challenge = "Walk into a shop and ask to try on 10 things", EndsInSeconds = 252, Viewers = 412, PassVotes = 543, FailVotes = 271, ColorKey = "wall" },
            new LiveSession { PlayerNo = "199", Initials = "AK", Name = "Arjun K",  City = "Mumbai",    SeasonRank = 11, Challenge = "Order food only using hand signs",            EndsInSeconds = 104, Viewers = 88,  PassVotes = 90,  FailVotes = 86,  ColorKey = "teal" },
            new LiveSession { PlayerNo = "412", Initials = "LM", Name = "Lila M",   City = "Seoul",     SeasonRank = 7,  Challenge = "Get 5 strangers to do a group photo with you", EndsInSeconds = 388, Viewers = 231, PassVotes = 189, FailVotes = 44,  ColorKey = "door" }
        );

        // Season 4 — prize pool seeded in Coins (14,847,000); ends in 12 days.
        db.Seasons.Add(new Season { Number = 4, StartsAt = now.AddDays(-18), EndsAt = now.AddDays(12), PrizePoolCoins = 14_847_000L });

        db.SaveChanges();
    }
}
