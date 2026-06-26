using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace DareApi.Tests;

/// <summary>
/// Integration tests over the real HTTP surface of the Season 4 API, each against a
/// fresh in-memory database. Covers the feed, the vote-to-earn loop (including the
/// failure paths), the season pool, the leaderboard, the profile, and posting a dare.
/// </summary>
public class ApiTests
{
    static async Task<JsonElement> Get(HttpClient c, string url) =>
        await c.GetFromJsonAsync<JsonElement>(url);

    static IEnumerable<JsonElement> Items(JsonElement array) => array.EnumerateArray();

    // ── Feed ──────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Feed_returns_six_seeded_drops_with_colors_and_pool_contribution()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/feed");

        Assert.Equal(JsonValueKind.Array, feed.ValueKind);
        Assert.Equal(6, feed.GetArrayLength());
        Assert.Contains(Items(feed), e => e.GetProperty("title").GetString() == "Rubik's cube blindfolded");

        var card = Items(feed).First(e => e.GetProperty("title").GetString() == "Rubik's cube blindfolded");
        var votes = card.GetProperty("votes").GetInt32();
        Assert.Equal(3210, votes);
        // poolContrib is derived from votes at 3 Coins/vote
        Assert.Equal(votes * 3, card.GetProperty("poolContrib").GetInt32());
        // glass color fields are populated from the server palette
        Assert.False(string.IsNullOrWhiteSpace(card.GetProperty("glTop").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(card.GetProperty("deep").GetString()));
    }

    [Fact]
    public async Task Feed_orders_newest_first()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/feed");

        Assert.Equal("001", feed[0].GetProperty("playerNo").GetString());
    }

    // ── Season ────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Season_returns_pool_days_left_and_three_way_split()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var s = await Get(client, "/api/season/current");

        Assert.Equal(4, s.GetProperty("number").GetInt32());
        Assert.Equal(14847000.0, s.GetProperty("prizePool").GetDouble());
        Assert.InRange(s.GetProperty("daysLeft").GetInt32(), 11, 12);

        var splits = s.GetProperty("splits");
        Assert.Equal(4454100.0, splits.GetProperty("voters").GetDouble());   // 30%
        Assert.Equal(7423500.0, splits.GetProperty("creators").GetDouble()); // 50%
        Assert.Equal(2969400.0, splits.GetProperty("platform").GetDouble()); // 20%
    }

    // ── Leaderboard ─────────────────────────────────────────────────────────────
    [Fact]
    public async Task Leaderboard_returns_top_ten_ordered_by_points_with_me_at_rank_seven()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var lb = await Get(client, "/api/leaderboard");

        Assert.Equal(10, lb.GetArrayLength());

        var points = Items(lb).Select(e => e.GetProperty("points").GetInt32()).ToList();
        for (var i = 1; i < points.Count; i++)
            Assert.True(points[i] <= points[i - 1], "leaderboard must be ordered by points descending");

        var me = Items(lb).Single(e => e.GetProperty("isMe").GetBoolean());
        Assert.Equal("You", me.GetProperty("name").GetString());
        Assert.Equal(7, me.GetProperty("rank").GetInt32());
    }

    // ── Profile ─────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Me_returns_demo_profile()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var me = await Get(client, "/api/me");

        Assert.Equal("your_username", me.GetProperty("username").GetString());
        Assert.Equal(7, me.GetProperty("cityRank").GetInt32());
        Assert.Equal(4370, me.GetProperty("earnings").GetProperty("total").GetInt32());
        Assert.Equal(612, me.GetProperty("earnings").GetProperty("votesGiven").GetInt32());
    }

    // ── Vote loop (happy path + persistence) ────────────────────────────────────
    [Fact]
    public async Task Vote_pass_persists_increment_and_earns_three_tenths_of_a_cent()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/feed");
        var id = feed[0].GetProperty("id").GetInt32();
        var before = feed[0].GetProperty("votes").GetInt32();

        var resp = await client.PostAsJsonAsync($"/api/drops/{id}/vote", new { verdict = "pass" });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        Assert.False(body.GetProperty("alreadyVoted").GetBoolean());
        Assert.Equal(3, body.GetProperty("earned").GetInt32());
        Assert.Equal(before + 1, body.GetProperty("votes").GetInt32());
        Assert.Equal(613, body.GetProperty("myVotes").GetInt32());

        // Persisted: re-fetching the feed shows the incremented tally
        var feed2 = await Get(client, "/api/feed");
        var same = Items(feed2).Single(e => e.GetProperty("id").GetInt32() == id);
        Assert.Equal(before + 1, same.GetProperty("votes").GetInt32());
    }

    // ── Vote loop (failure / edge paths) ────────────────────────────────────────
    [Fact]
    public async Task Vote_twice_by_same_user_is_idempotent_and_pays_once()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/feed");
        var id = feed[0].GetProperty("id").GetInt32();

        var first = await (await client.PostAsJsonAsync($"/api/drops/{id}/vote", new { verdict = "pass" }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var second = await (await client.PostAsJsonAsync($"/api/drops/{id}/vote", new { verdict = "pass" }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(second.GetProperty("alreadyVoted").GetBoolean());
        Assert.Equal(0, second.GetProperty("earned").GetInt32());
        Assert.Equal(first.GetProperty("votes").GetInt32(), second.GetProperty("votes").GetInt32());
        Assert.Equal(first.GetProperty("myVotes").GetInt32(), second.GetProperty("myVotes").GetInt32());
    }

    [Fact]
    public async Task Vote_with_invalid_verdict_returns_400()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/drops/1/vote", new { verdict = "maybe" });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Vote_on_unknown_drop_returns_404()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/drops/99999/vote", new { verdict = "pass" });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Post a dare ─────────────────────────────────────────────────────────────
    [Fact]
    public async Task Posting_a_dare_adds_it_to_top_of_feed_and_increments_challenges()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feedBefore = await Get(client, "/api/feed");
        var meBefore = await Get(client, "/api/me");
        var challengesBefore = meBefore.GetProperty("completedTasks").GetInt32();

        const string title = "Do 40 burpees in a public park";
        var resp = await client.PostAsJsonAsync("/api/dares",
            new { challenge = title, category = "physical", difficulty = "hard", timeLimit = "30", bounty = "50", isPublic = true });
        resp.EnsureSuccessStatusCode();

        var created = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(title, created.GetProperty("title").GetString());
        Assert.Equal("Physical", created.GetProperty("category").GetString());
        Assert.Equal(200, created.GetProperty("pts").GetInt32()); // hard => 200

        var feedAfter = await Get(client, "/api/feed");
        Assert.Equal(feedBefore.GetArrayLength() + 1, feedAfter.GetArrayLength());
        Assert.Equal(title, feedAfter[0].GetProperty("title").GetString()); // newest at the top
        Assert.Contains(Items(feedAfter), e => e.GetProperty("title").GetString() == title);

        var meAfter = await Get(client, "/api/me");
        Assert.Equal(challengesBefore + 1, meAfter.GetProperty("completedTasks").GetInt32());
    }

    [Fact]
    public async Task Posting_a_dare_with_too_short_challenge_returns_400()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/dares",
            new { challenge = "short", category = "social", difficulty = "easy", timeLimit = "15", bounty = (string?)null, isPublic = true });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}
