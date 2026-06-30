-- Season 4
INSERT INTO seasons (number, prize_pool_coins, starts_at, ends_at)
VALUES (4, 14847000, NOW() - INTERVAL '18 days', NOW() + INTERVAL '12 days')
ON CONFLICT (number) DO NOTHING;

-- Open dares
INSERT INTO dares (slug, title, category, difficulty, rep_reward, color_key, expires_at)
VALUES
  ('do-30-squats-in-a-public-park',    'Do 30 squats in a public park',    'Physical', 'medium', 80,  'teal', NOW() + INTERVAL '6 hours'),
  ('compliment-5-strangers-on-camera', 'Compliment 5 strangers on camera', 'Social',   'easy',   30,  'gold', NOW() + INTERVAL '12 hours'),
  ('sprint-100m-under-15-seconds',     'Sprint 100m under 15 seconds',     'Speed',    'hard',   200, 'door', NOW() + INTERVAL '3 hours'),
  ('sing-full-song-in-a-metro',        'Sing full song in a metro',        'Social',   'medium', 80,  'gold', NOW() + INTERVAL '24 hours'),
  ('50-pushups-in-a-mall',             '50 pushups in a mall',             'Physical', 'hard',   200, 'wall', NOW() + INTERVAL '24 hours'),
  ('rubiks-cube-blindfolded',          'Rubik''s cube blindfolded',        'Speed',    'hard',   200, 'wall', NOW() + INTERVAL '24 hours')
ON CONFLICT (slug) DO NOTHING;

-- Live sessions
INSERT INTO live_sessions (player_no, initials, name, city, season_rank, challenge, ends_in_seconds, viewers, pass_votes, fail_votes, color_key)
VALUES
  ('067', 'SR', 'Sana Rao',  'Hyderabad', 4,  'Walk into a shop and ask to try on 10 things',   252, 412, 543, 271, 'wall'),
  ('199', 'AK', 'Arjun K',   'Mumbai',    11, 'Order food only using hand signs',               104, 88,  90,  86,  'teal'),
  ('412', 'LM', 'Lila M',    'Seoul',     7,  'Get 5 strangers to do a group photo with you',   388, 231, 189, 44,  'door')
ON CONFLICT DO NOTHING;
