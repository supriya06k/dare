using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;

// ── Dare & Validate — v0 vertical slice ───────────────────────────────────────
// Thin, real, end-to-end loop: list challenges → submit → (stub) verify →
// Score/Coins ledger → leaderboard. Hard parts (auth, video, jury, ML) stubbed.
// Maps to DESIGN.md §6.4 (subset) + ADR-005/006/018/020.

const int DemoUserId = 1;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://localhost:5099");
builder.Services.AddDbContext<DareDb>(o => o.UseSqlite("Data Source=dare.db"));
var app = builder.Build();

// ── DB init + seed ────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DareDb>();
    db.Database.EnsureCreated();
    Seed.Run(db);
}

// ── Static prototype (served same-origin so the canvas app can call /api) ──────
var repoRoot = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, ".."));
var files = new PhysicalFileProvider(repoRoot);
app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = files, DefaultFileNames = new List<string> { "index.html" } });
app.UseStaticFiles(new StaticFileOptions { FileProvider = files });

// ── Helpers ───────────────────────────────────────────────────────────────────
static int Balance(DareDb db, int userId, string currency) =>
    db.Ledger.Where(l => l.UserId == userId && l.Currency == currency && l.Status == "confirmed")
             .Sum(l => (int?)l.Delta) ?? 0;

// ── API ───────────────────────────────────────────────────────────────────────
app.MapGet("/api/challenges", (DareDb db) =>
    db.Challenges.Where(c => c.LifecycleState == "live").OrderBy(c => c.Id)
        .Select(c => new {
            id = c.Id, emoji = c.Emoji, label = c.Label, cat = c.Category,
            title = c.Title, desc = c.Description, pts = c.Points, ca = c.ColorA, cb = c.ColorB
        }).ToList());

app.MapGet("/api/me", (DareDb db) =>
{
    var u = db.Users.Find(DemoUserId);
    return u is null ? Results.NotFound()
        : Results.Ok(new { id = u.Id, handle = u.Handle, score = Balance(db, u.Id, "score"), coins = Balance(db, u.Id, "coins") });
});

app.MapPost("/api/submissions", (SubmitDto dto, DareDb db) =>
{
    var ch = db.Challenges.Find(dto.ChallengeId);
    if (ch is null) return Results.NotFound(new { error = "unknown challenge" });
    var sub = new Submission { UserId = DemoUserId, ChallengeId = ch.Id, State = "submitted", CreatedAt = DateTime.UtcNow };
    db.Submissions.Add(sub);
    db.SaveChanges();
    return Results.Ok(new { id = sub.Id, challengeId = sub.ChallengeId, state = sub.State });
});

// Stub for the verification jury (ADR-009/010): manual verdict.
app.MapPost("/api/submissions/{id:int}/verify", (int id, DareDb db) =>
{
    var sub = db.Submissions.Find(id);
    if (sub is null) return Results.NotFound();
    if (sub.State == "verified") return Results.Ok(new { id = sub.Id, state = sub.State, note = "already verified" });
    var ch = db.Challenges.Find(sub.ChallengeId)!;
    sub.State = "verified";
    // Score = difficulty-weighted by challenge points (ADR-020); Coins wallet (ADR-018).
    db.Ledger.Add(new LedgerEntry { UserId = sub.UserId, Currency = "score", Delta = ch.Points, Reason = $"verified:{ch.Id}", Status = "confirmed", CreatedAt = DateTime.UtcNow });
    db.Ledger.Add(new LedgerEntry { UserId = sub.UserId, Currency = "coins", Delta = ch.Points / 2, Reason = $"verified:{ch.Id}", Status = "confirmed", CreatedAt = DateTime.UtcNow });
    db.SaveChanges();
    return Results.Ok(new { id = sub.Id, state = sub.State, awarded = new { score = ch.Points, coins = ch.Points / 2 } });
});

app.MapGet("/api/leaderboard", (DareDb db) =>
{
    var scores = db.Ledger.Where(l => l.Currency == "score" && l.Status == "confirmed")
        .GroupBy(l => l.UserId).Select(g => new { UserId = g.Key, Score = g.Sum(x => x.Delta) }).ToList();
    return db.Users.AsEnumerable()
        .Select(u => new { handle = u.Handle, score = scores.FirstOrDefault(s => s.UserId == u.Id)?.Score ?? 0, isMe = u.Id == DemoUserId })
        .OrderByDescending(x => x.score).ThenBy(x => x.handle).Take(10).ToList();
});

app.Run();

// ── DTOs / model (slice subset of DESIGN.md §6.4) ─────────────────────────────
record SubmitDto(int ChallengeId);

class User { public int Id { get; set; } public string Handle { get; set; } = ""; }
class Challenge
{
    public int Id { get; set; }
    public string Emoji { get; set; } = "";
    public string Label { get; set; } = "";
    public string Category { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public int Points { get; set; }
    public string ColorA { get; set; } = "";
    public string ColorB { get; set; } = "";
    public string LifecycleState { get; set; } = "live"; // ADR-012
}
class Submission
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int ChallengeId { get; set; }
    public string State { get; set; } = "submitted"; // ADR-005 state machine
    public DateTime CreatedAt { get; set; }
}
class LedgerEntry // append-only (ADR-006); currency split (ADR-018)
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Currency { get; set; } = "score"; // score | coins
    public int Delta { get; set; }
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "confirmed"; // pending | confirmed | void
    public DateTime CreatedAt { get; set; }
}

class DareDb : DbContext
{
    public DareDb(DbContextOptions<DareDb> options) : base(options) { }
    public DbSet<User> Users => Set<User>();
    public DbSet<Challenge> Challenges => Set<Challenge>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<LedgerEntry> Ledger => Set<LedgerEntry>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // Challenge/User Ids are caller-assigned (seed maps to the prototype's dare ids 0-5).
        mb.Entity<Challenge>().Property(c => c.Id).ValueGeneratedNever();
        mb.Entity<User>().Property(u => u.Id).ValueGeneratedNever();
    }
}

static class Seed
{
    public static void Run(DareDb db)
    {
        if (db.Challenges.Any()) return;

        db.Challenges.AddRange(
            new Challenge { Id = 0, Emoji = "🤹", Label = "Juggle 5×30s", Category = "SKILL CHALLENGE", Title = "Juggle 5 Objects for 30 Seconds", Description = "Any objects, any technique. Keep all 5 in the air for a full 30 seconds.", Points = 75, ColorA = "#0ff4c6", ColorB = "#7b2fff" },
            new Challenge { Id = 1, Emoji = "🎤", Label = "60s Freestyle", Category = "CREATIVE CHALLENGE", Title = "60-Second Freestyle Rap About Your Day", Description = "No prep, no backing track. Rhymed on the spot, uncut.", Points = 50, ColorA = "#ff6b35", ColorB = "#ff2d55" },
            new Challenge { Id = 2, Emoji = "✏️", Label = "Portrait 90s", Category = "CREATIVE CHALLENGE", Title = "Draw a Portrait in 90 Seconds", Description = "Any drawing medium. Timer visible throughout. 90 seconds. Go.", Points = 25, ColorA = "#a78bfa", ColorB = "#0ff4c6" },
            new Challenge { Id = 3, Emoji = "🎸", Label = "Riff in 2 Min", Category = "SKILL CHALLENGE", Title = "Learn & Play a Guitar Riff in One Take", Description = "First comment names the song. Two minutes to learn it. One take.", Points = 100, ColorA = "#ffd60a", ColorB = "#ff6b35" },
            new Challenge { Id = 4, Emoji = "🏃", Label = "100 Reps×3Min", Category = "FITNESS CHALLENGE", Title = "100 Bodyweight Reps Under 3 Minutes", Description = "Push-ups, squats, or burpees. Hit 100 reps before the clock expires.", Points = 60, ColorA = "#ff2d55", ColorB = "#b464ff" },
            new Challenge { Id = 5, Emoji = "😂", Label = "Rhyme-Only Convo", Category = "SOCIAL CHALLENGE", Title = "Hold a 2-Minute Conversation Only in Rhymes", Description = "Every sentence must end in a rhyme. Two minutes. Real topic.", Points = 40, ColorA = "#f472b6", ColorB = "#7b2fff" }
        );

        db.Users.AddRange(
            new User { Id = 1, Handle = "you" }, // 1 = DemoUserId
            new User { Id = 2, Handle = "NovaStrike" },
            new User { Id = 3, Handle = "EchoFox" },
            new User { Id = 4, Handle = "ZenithRay" },
            new User { Id = 5, Handle = "PixelMonk" }
        );

        // Seed a sample season board (append-only ledger is the source of truth).
        void Score(int uid, int n, string why) => db.Ledger.Add(new LedgerEntry { UserId = uid, Currency = "score", Delta = n, Reason = why, Status = "confirmed", CreatedAt = DateTime.UtcNow });
        Score(2, 320, "seed"); Score(3, 245, "seed"); Score(4, 180, "seed"); Score(5, 95, "seed");

        db.SaveChanges();
    }
}
