using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DareApi.Tests;

/// <summary>
/// Hosts the real API in-process but swaps three things for deterministic tests:
/// the SQLite file database → a private, kept-open in-memory connection (fresh seed
/// per test); the system clock → a controllable <see cref="FakeClock"/> (so the 60s
/// voting window and 20-minute accept deadline are deterministic); and the AI
/// pre-screen → a <see cref="FakeScreener"/> whose verdict a test can force.
/// </summary>
internal sealed class TestApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection;

    /// <summary>Fixed, controllable wall clock shared by the seed and every request.</summary>
    public FakeClock Clock { get; } = new(new DateTimeOffset(2026, 6, 1, 0, 0, 0, TimeSpan.Zero));

    /// <summary>AI pre-screen stand-in — set <see cref="FakeScreener.Next"/> to force a verdict.</summary>
    public FakeScreener Screener { get; } = new();

    public TestApiFactory()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll(typeof(DbContextOptions<DareDb>));
            services.RemoveAll(typeof(DareDb));
            services.AddDbContext<DareDb>(o => o.UseSqlite(_connection));

            services.RemoveAll(typeof(TimeProvider));
            services.AddSingleton<TimeProvider>(Clock);

            services.RemoveAll(typeof(IProofScreener));
            services.AddSingleton<IProofScreener>(Screener);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connection.Dispose();
    }
}

/// <summary>A settable <see cref="TimeProvider"/> so time-based logic is deterministic.</summary>
internal sealed class FakeClock(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;
    public override DateTimeOffset GetUtcNow() => _now;
    public void Advance(TimeSpan delta) => _now = _now.Add(delta);
}

/// <summary>An <see cref="IProofScreener"/> that returns whatever verdict the test sets.</summary>
internal sealed class FakeScreener : IProofScreener
{
    public ProofVerdict Next { get; set; } = new(true, 0.99, "forced pass");
    public ProofVerdict Screen(string title, string proofUrl) => Next;
}
