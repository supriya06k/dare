using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Xunit;

namespace DareApi.Tests;

/// <summary>
/// Integration tests over the real HTTP surface of the Season 4 API, each against a
/// fresh in-memory database with a controllable clock + AI screener. Covers the feed,
/// the vote-to-earn loop and its failure paths, the verification engine (AI auto-resolve
/// and the 60s crowd override), the accept → proof → forfeit flow, the entry-fee prize
/// pool, the ledger-summed balance, the season split, the leaderboard, and the profile.
/// </summary>
public class ApiTests
{
    static async Task<JsonElement> Get(HttpClient c, string url) =>
        await c.GetFromJsonAsync<JsonElement>(url);

    static async Task<JsonElement> Post(HttpClient c, string url, object body)
    {
        var resp = await c.PostAsJsonAsync(url, body);
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<JsonElement>();
    }

    static IEnumerable<JsonElement> Items(JsonElement array) => array.EnumerateArray();

    // ── Feed ──────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Feed_returns_six_seeded_drops_with_colors_and_pool_contribution()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/drops");

        Assert.Equal(JsonValueKind.Array, feed.ValueKind);
        Assert.Equal(6, feed.GetArrayLength());
        Assert.Contains(Items(feed), e => e.GetProperty("title").GetString() == "Rubik's cube blindfolded");

        var card = Items(feed).First(e => e.GetProperty("title").GetString() == "Rubik's cube blindfolded");
        var votes = card.GetProperty("votes").GetInt32();
        Assert.Equal(3210, votes);
        Assert.Equal(votes * 3, card.GetProperty("poolContrib").GetInt32()); // 3 Coins/vote
        Assert.Equal("verified", card.GetProperty("status").GetString());
        Assert.True(card.GetProperty("verified").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(card.GetProperty("glTop").GetString()));
        Assert.False(string.IsNullOrWhiteSpace(card.GetProperty("deep").GetString()));
    }

    [Fact]
    public async Task Feed_orders_newest_first()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/drops");

        Assert.Equal("001", feed[0].GetProperty("playerNo").GetString());
    }

    // ── Season ────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Season_returns_pool_days_left_and_three_way_split()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var s = await Get(client, "/api/seasons/current");

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

        var lb = await Get(client, "/api/seasons/4/leaderboard");

        Assert.Equal(10, lb.GetArrayLength());

        var points = Items(lb).Select(e => e.GetProperty("points").GetInt32()).ToList();
        for (var i = 1; i < points.Count; i++)
            Assert.True(points[i] <= points[i - 1], "leaderboard must be ordered by points descending");

        var me = Items(lb).Single(e => e.GetProperty("isMe").GetBoolean());
        Assert.Equal("You", me.GetProperty("name").GetString());
        Assert.Equal(7, me.GetProperty("rank").GetInt32());
    }

    [Fact]
    public async Task Leaderboard_for_unknown_season_returns_404()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/seasons/99/leaderboard");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Profile ─────────────────────────────────────────────────────────────────
    [Fact]
    public async Task Me_returns_demo_profile_with_ledger_summed_balance()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var me = await Get(client, "/api/users/me");

        Assert.Equal("your_username", me.GetProperty("username").GetString());
        Assert.Equal(7, me.GetProperty("cityRank").GetInt32());
        Assert.Equal(4370, me.GetProperty("earnings").GetProperty("total").GetInt32()); // opening ledger
        Assert.Equal(612, me.GetProperty("earnings").GetProperty("votesGiven").GetInt32());
    }

    // ── Vote loop (happy path + persistence) ────────────────────────────────────
    [Fact]
    public async Task Vote_pass_persists_increment_and_earns_three_coins()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/drops");
        var id = feed[0].GetProperty("id").GetInt32();
        var before = feed[0].GetProperty("votes").GetInt32();

        var body = await Post(client, $"/api/drops/{id}/vote", new { verdict = "pass" });

        Assert.False(body.GetProperty("alreadyVoted").GetBoolean());
        Assert.Equal(3, body.GetProperty("earned").GetInt32());
        Assert.Equal(before + 1, body.GetProperty("votes").GetInt32());
        Assert.Equal(613, body.GetProperty("myVotes").GetInt32());
        Assert.Equal((before + 1) * 3, body.GetProperty("poolContrib").GetInt32()); // server-computed

        // Persisted: re-fetching the feed shows the incremented tally
        var feed2 = await Get(client, "/api/drops");
        var same = Items(feed2).Single(e => e.GetProperty("id").GetInt32() == id);
        Assert.Equal(before + 1, same.GetProperty("votes").GetInt32());

        // Persisted: the voter's balance is the ledger sum (opening 4370 + 3)
        var me = await Get(client, "/api/users/me");
        Assert.Equal(4373, me.GetProperty("earnings").GetProperty("total").GetInt32());
    }

    // ── Vote loop (failure / edge paths) ────────────────────────────────────────
    [Fact]
    public async Task Vote_twice_by_same_user_is_idempotent_and_pays_once()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var feed = await Get(client, "/api/drops");
        var id = feed[0].GetProperty("id").GetInt32();

        var first = await Post(client, $"/api/drops/{id}/vote", new { verdict = "pass" });
        var second = await Post(client, $"/api/drops/{id}/vote", new { verdict = "pass" });

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

    // ── Verification engine: AI auto-resolve ────────────────────────────────────
    [Fact]
    public async Task Compose_with_high_confidence_pass_auto_verifies()
    {
        using var factory = new TestApiFactory();
        factory.Screener.Next = new ProofVerdict(true, 0.99, "clearly passes");
        var client = factory.CreateClient();

        var created = await Post(client, "/api/dares",
            new { challenge = "Solve a cube in under a minute", category = "speed", difficulty = "hard", timeLimit = "60", bounty = (string?)null, isPublic = true });

        Assert.Equal("verified", created.GetProperty("status").GetString());
        Assert.True(created.GetProperty("verified").GetBoolean());
    }

    [Fact]
    public async Task Compose_with_high_confidence_fail_is_ai_rejected_and_hidden_from_feed()
    {
        using var factory = new TestApiFactory();
        factory.Screener.Next = new ProofVerdict(false, 0.97, "clearly fails");
        var client = factory.CreateClient();

        const string title = "Obviously faked proof submission";
        var created = await Post(client, "/api/dares",
            new { challenge = title, category = "physical", difficulty = "medium", timeLimit = "30", bounty = (string?)null, isPublic = true });

        Assert.Equal("ai_rejected", created.GetProperty("status").GetString());

        var feed = await Get(client, "/api/drops");
        Assert.DoesNotContain(Items(feed), e => e.GetProperty("title").GetString() == title);
    }

    // ── Verification engine: crowd override (Humans vs The Machine) ─────────────
    [Fact]
    public async Task Uncertain_drop_opens_voting_and_crowd_pass_overrides_to_verified()
    {
        using var factory = new TestApiFactory();
        factory.Screener.Next = new ProofVerdict(true, 0.50, "uncertain — crowd decides");
        var client = factory.CreateClient();

        var created = await Post(client, "/api/dares",
            new { challenge = "A borderline rep-count attempt", category = "physical", difficulty = "medium", timeLimit = "30", bounty = (string?)null, isPublic = true });
        var id = created.GetProperty("id").GetInt32();
        Assert.Equal("voting", created.GetProperty("status").GetString());

        await Post(client, $"/api/drops/{id}/vote", new { verdict = "pass" }); // 100% pass
        factory.Clock.Advance(TimeSpan.FromSeconds(61));                       // window closes

        var drop = await Get(client, $"/api/drops/{id}");
        Assert.Equal("verified", drop.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Uncertain_drop_without_override_is_rejected_when_window_closes()
    {
        using var factory = new TestApiFactory();
        factory.Screener.Next = new ProofVerdict(true, 0.50, "uncertain — crowd decides");
        var client = factory.CreateClient();

        var created = await Post(client, "/api/dares",
            new { challenge = "Another borderline attempt here", category = "physical", difficulty = "medium", timeLimit = "30", bounty = (string?)null, isPublic = true });
        var id = created.GetProperty("id").GetInt32();

        await Post(client, $"/api/drops/{id}/vote", new { verdict = "fail" }); // 0% pass → AI verdict stands
        factory.Clock.Advance(TimeSpan.FromSeconds(61));

        var drop = await Get(client, $"/api/drops/{id}");
        Assert.Equal("rejected", drop.GetProperty("status").GetString());

        var feed = await Get(client, "/api/drops");
        Assert.DoesNotContain(Items(feed), e => e.GetProperty("id").GetInt32() == id);
    }

    // ── Accept → proof / forfeit flow ───────────────────────────────────────────
    [Fact]
    public async Task Accept_ranked_dare_funds_pool_from_entry_fee_and_opens_deadline()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var dares = await Get(client, "/api/dares");
        var ranked = Items(dares).First(d => d.GetProperty("isRanked").GetBoolean() && d.GetProperty("entryFee").GetInt64() > 0);
        var dareId = ranked.GetProperty("id").GetInt32();
        var entryFee = ranked.GetProperty("entryFee").GetInt64();

        var poolBefore = (await Get(client, "/api/seasons/current")).GetProperty("prizePool").GetInt64();

        var accept = await Post(client, $"/api/dares/{dareId}/accept", new { });

        Assert.Equal("accepted", accept.GetProperty("status").GetString());
        Assert.InRange(accept.GetProperty("secondsLeft").GetInt32(), 1190, 1200); // ~20 min
        Assert.Equal(entryFee, accept.GetProperty("entryFee").GetInt64());
        Assert.Equal(poolBefore + entryFee, accept.GetProperty("prizePool").GetInt64());

        var poolAfter = (await Get(client, "/api/seasons/current")).GetProperty("prizePool").GetInt64();
        Assert.Equal(poolBefore + entryFee, poolAfter);
    }

    [Fact]
    public async Task Submitting_proof_before_deadline_runs_the_screener()
    {
        using var factory = new TestApiFactory();
        factory.Screener.Next = new ProofVerdict(true, 0.99, "clean proof");
        var client = factory.CreateClient();

        var dares = await Get(client, "/api/dares");
        var dareId = Items(dares).First().GetProperty("id").GetInt32();
        var accept = await Post(client, $"/api/dares/{dareId}/accept", new { });
        var dropId = accept.GetProperty("dropId").GetInt32();

        var card = await Post(client, $"/api/drops/{dropId}/proof", new { proofUrl = "https://cdn.example/proof.mp4" });

        Assert.Equal("verified", card.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Missing_the_accept_deadline_forfeits_and_is_recorded_on_the_profile()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var dares = await Get(client, "/api/dares");
        var dareId = Items(dares).First().GetProperty("id").GetInt32();
        var accept = await Post(client, $"/api/dares/{dareId}/accept", new { });
        var dropId = accept.GetProperty("dropId").GetInt32();

        factory.Clock.Advance(TimeSpan.FromMinutes(21)); // miss the 20-minute window

        var result = await Post(client, $"/api/drops/{dropId}/proof", new { proofUrl = "https://cdn.example/late.mp4" });
        Assert.Equal("forfeited", result.GetProperty("status").GetString());
        Assert.True(result.GetProperty("forfeited").GetBoolean());

        var me = await Get(client, "/api/users/me");
        Assert.Equal(1, me.GetProperty("forfeits").GetInt32());
    }

    [Fact]
    public async Task Accepting_an_unknown_dare_returns_404()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/dares/99999/accept", new { });

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Compose validation ──────────────────────────────────────────────────────
    [Fact]
    public async Task Posting_a_dare_adds_it_to_top_of_feed_and_increments_challenges()
    {
        using var factory = new TestApiFactory();
        factory.Screener.Next = new ProofVerdict(true, 0.99, "pass"); // appears in feed as verified
        var client = factory.CreateClient();

        var feedBefore = await Get(client, "/api/drops");
        var meBefore = await Get(client, "/api/users/me");
        var challengesBefore = meBefore.GetProperty("completedTasks").GetInt32();

        const string title = "Do 40 burpees in a public park";
        var created = await Post(client, "/api/dares",
            new { challenge = title, category = "physical", difficulty = "hard", timeLimit = "30", bounty = "50", isPublic = true });

        Assert.Equal(title, created.GetProperty("title").GetString());
        Assert.Equal("Physical", created.GetProperty("category").GetString());
        Assert.Equal(200, created.GetProperty("pts").GetInt32()); // hard => 200

        var feedAfter = await Get(client, "/api/drops");
        Assert.Equal(feedBefore.GetArrayLength() + 1, feedAfter.GetArrayLength());
        Assert.Equal(title, feedAfter[0].GetProperty("title").GetString()); // newest at the top

        var meAfter = await Get(client, "/api/users/me");
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

    // ── Live arena voting (now persisted) ───────────────────────────────────────
    [Fact]
    public async Task Live_vote_persists_tally_and_earns_three_coins()
    {
        using var factory = new TestApiFactory();
        var client = factory.CreateClient();

        var live = await Get(client, "/api/live");
        var id = live[0].GetProperty("id").GetInt32();
        var passBefore = live[0].GetProperty("passVotes").GetInt32();

        var body = await Post(client, $"/api/live/{id}/vote", new { verdict = "pass" });

        Assert.Equal(passBefore + 1, body.GetProperty("passVotes").GetInt32());
        Assert.Equal(3, body.GetProperty("earned").GetInt32());
        Assert.Equal(613, body.GetProperty("myVotes").GetInt32());

        var live2 = await Get(client, "/api/live");
        var same = Items(live2).Single(e => e.GetProperty("id").GetInt32() == id);
        Assert.Equal(passBefore + 1, same.GetProperty("passVotes").GetInt32());
    }
}
