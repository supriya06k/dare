-- Users
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    firebase_uid    TEXT UNIQUE NOT NULL,
    phone           TEXT UNIQUE NOT NULL,
    handle          TEXT UNIQUE,
    name            TEXT,
    city            TEXT,
    player_no       TEXT UNIQUE,
    avatar_url      TEXT,
    rep             INTEGER NOT NULL DEFAULT 0,
    streak          INTEGER NOT NULL DEFAULT 0,
    challenges      INTEGER NOT NULL DEFAULT 0,  -- completed dare count
    forfeits        INTEGER NOT NULL DEFAULT 0,
    votes_given     INTEGER NOT NULL DEFAULT 0,
    fcm_token       TEXT,  -- push notification device token
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dares (canonical challenge ideas)
CREATE TABLE IF NOT EXISTS dares (
    id                  BIGSERIAL PRIMARY KEY,
    slug                TEXT UNIQUE NOT NULL,
    title               TEXT NOT NULL,
    category            TEXT NOT NULL,            -- Physical | Social | Speed | Creative
    difficulty          TEXT NOT NULL DEFAULT 'medium',
    rep_reward          INTEGER NOT NULL DEFAULT 80,
    color_key           TEXT NOT NULL DEFAULT 'teal',
    originator_user_id  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    is_brand_dare       BOOLEAN NOT NULL DEFAULT FALSE,
    sponsor_id          BIGINT,
    total_drops         INTEGER NOT NULL DEFAULT 0,
    total_verified      INTEGER NOT NULL DEFAULT 0,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drops (a user's attempt at a dare)
CREATE TABLE IF NOT EXISTS drops (
    id                   BIGSERIAL PRIMARY KEY,
    dare_id              BIGINT NOT NULL REFERENCES dares(id),
    user_id              BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status               TEXT NOT NULL DEFAULT 'accepted',
    -- accepted | pending | voting | verified | rejected | ai_rejected | forfeited
    proof_url            TEXT,           -- R2 key or external URL
    proof_submitted_at   TIMESTAMPTZ,
    ai_confidence        FLOAT,
    pass_votes           INTEGER NOT NULL DEFAULT 0,
    fail_votes           INTEGER NOT NULL DEFAULT 0,
    voting_ends_at       TIMESTAMPTZ,
    deadline_at          TIMESTAMPTZ,
    rep_awarded          INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Votes cast by crowd on drops
CREATE TABLE IF NOT EXISTS votes (
    id              BIGSERIAL PRIMARY KEY,
    drop_id         BIGINT NOT NULL REFERENCES drops(id),
    voter_user_id   BIGINT NOT NULL REFERENCES users(id),
    verdict         TEXT NOT NULL,  -- pass | fail
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(drop_id, voter_user_id)
);

-- Financial ledger — every coin/score movement
CREATE TABLE IF NOT EXISTS ledger (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    currency    TEXT NOT NULL,    -- coins | score | usd | inr
    amount      NUMERIC NOT NULL,
    reason      TEXT NOT NULL,
    ref_id      TEXT,             -- drop_id, payout_id etc
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seasons
CREATE TABLE IF NOT EXISTS seasons (
    id               BIGSERIAL PRIMARY KEY,
    number           INTEGER NOT NULL UNIQUE,
    prize_pool_coins BIGINT NOT NULL DEFAULT 0,
    starts_at        TIMESTAMPTZ NOT NULL,
    ends_at          TIMESTAMPTZ NOT NULL
);

-- Live sessions (active dare performances)
CREATE TABLE IF NOT EXISTS live_sessions (
    id              BIGSERIAL PRIMARY KEY,
    drop_id         BIGINT REFERENCES drops(id),
    player_no       TEXT NOT NULL DEFAULT '',
    initials        TEXT NOT NULL DEFAULT '',
    name            TEXT NOT NULL DEFAULT '',
    city            TEXT NOT NULL DEFAULT '',
    season_rank     INTEGER NOT NULL DEFAULT 0,
    challenge       TEXT NOT NULL DEFAULT '',
    ends_in_seconds INTEGER NOT NULL DEFAULT 0,
    viewers         INTEGER NOT NULL DEFAULT 0,
    pass_votes      INTEGER NOT NULL DEFAULT 0,
    fail_votes      INTEGER NOT NULL DEFAULT 0,
    color_key       TEXT NOT NULL DEFAULT 'teal',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payouts
CREATE TABLE IF NOT EXISTS payouts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    amount_usd      NUMERIC,
    amount_inr      NUMERIC,
    provider        TEXT NOT NULL,  -- stripe | razorpay
    provider_ref    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    -- pending | processing | paid | failed
    kyc_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at         TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drops_user_id ON drops(user_id);
CREATE INDEX IF NOT EXISTS idx_drops_dare_id ON drops(dare_id);
CREATE INDEX IF NOT EXISTS idx_drops_status ON drops(status);
CREATE INDEX IF NOT EXISTS idx_dares_slug ON dares(slug);
CREATE INDEX IF NOT EXISTS idx_dares_expires ON dares(expires_at);
CREATE INDEX IF NOT EXISTS idx_dares_category ON dares(category);
CREATE INDEX IF NOT EXISTS idx_votes_drop_id ON votes(drop_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user_id ON ledger(user_id);
