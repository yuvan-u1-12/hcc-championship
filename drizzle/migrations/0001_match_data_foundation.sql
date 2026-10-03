CREATE TABLE public.hcc_series (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'series' CHECK (kind IN ('series','tournament')),
  season text NOT NULL DEFAULT 'S1',
  parent_id text REFERENCES public.hcc_series(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hcc_matches (
  id text PRIMARY KEY,
  source text NOT NULL DEFAULT 'live' CHECK (source IN ('live','historical')),
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  series_id text REFERENCES public.hcc_series(id),
  room_code text,
  played_at timestamptz NOT NULL DEFAULT now(),
  venue text,
  home_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  away_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  toss_winner_team_id text REFERENCES public.hcc_teams(id),
  toss_choice text,
  winner_team_id text REFERENCES public.hcc_teams(id),
  result_type text CHECK (result_type IN ('win','draw','tie')),
  result_text text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hcc_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id text REFERENCES public.hcc_series(id),
  home_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  away_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  scheduled_at timestamptz,
  venue text,
  match_id text UNIQUE REFERENCES public.hcc_matches(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hcc_innings (
  match_id text NOT NULL REFERENCES public.hcc_matches(id) ON DELETE CASCADE,
  innings_no smallint NOT NULL CHECK (innings_no BETWEEN 1 AND 4),
  batting_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  bowling_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  runs integer NOT NULL DEFAULT 0,
  wickets smallint NOT NULL DEFAULT 0,
  legal_balls integer NOT NULL DEFAULT 0,
  declared boolean NOT NULL DEFAULT false,
  all_out boolean NOT NULL DEFAULT false,
  PRIMARY KEY (match_id, innings_no)
);
CREATE TABLE public.hcc_ball_events (
  id text PRIMARY KEY,
  match_id text NOT NULL REFERENCES public.hcc_matches(id) ON DELETE CASCADE,
  innings_no smallint NOT NULL CHECK (innings_no BETWEEN 1 AND 4),
  over_no smallint NOT NULL CHECK (over_no >= 1),
  ball_no smallint NOT NULL CHECK (ball_no BETWEEN 1 AND 6),
  batting_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  bowling_team_id text NOT NULL REFERENCES public.hcc_teams(id),
  striker_id text NOT NULL REFERENCES public.hcc_players(id),
  non_striker_id text REFERENCES public.hcc_players(id),
  bowler_id text NOT NULL REFERENCES public.hcc_players(id),
  phase text NOT NULL CHECK (phase IN ('NORMAL','CRAZY')),
  bat_number smallint NOT NULL CHECK (bat_number BETWEEN 0 AND 10),
  bowl_number smallint NOT NULL CHECK (bowl_number BETWEEN 0 AND 10),
  runs smallint NOT NULL,
  is_square boolean NOT NULL DEFAULT false,
  is_wicket boolean NOT NULL DEFAULT false,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, innings_no, over_no, ball_no)
);
CREATE INDEX hcc_ball_events_striker_idx ON public.hcc_ball_events(striker_id);
CREATE INDEX hcc_ball_events_bowler_idx ON public.hcc_ball_events(bowler_id);
CREATE TABLE public.hcc_player_match_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL REFERENCES public.hcc_matches(id) ON DELETE CASCADE,
  innings_no smallint NOT NULL CHECK (innings_no BETWEEN 1 AND 4),
  player_id text NOT NULL REFERENCES public.hcc_players(id),
  team_id text NOT NULL REFERENCES public.hcc_teams(id),
  runs integer,
  balls_faced integer,
  dismissed boolean,
  dismissed_by_id text REFERENCES public.hcc_players(id),
  balls_bowled integer,
  runs_conceded integer,
  wickets integer,
  UNIQUE (match_id, innings_no, player_id)
);
COMMENT ON TABLE public.hcc_player_match_entries IS 'Per-innings player lines for historical matches without ball events; live matches derive the same lines from hcc_ball_events.';

GRANT SELECT ON public.hcc_series, public.hcc_matches, public.hcc_fixtures, public.hcc_innings, public.hcc_ball_events, public.hcc_player_match_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hcc_series, public.hcc_matches, public.hcc_fixtures, public.hcc_innings, public.hcc_ball_events, public.hcc_player_match_entries TO authenticated;
GRANT ALL ON public.hcc_series, public.hcc_matches, public.hcc_fixtures, public.hcc_innings, public.hcc_ball_events, public.hcc_player_match_entries TO service_role;

ALTER TABLE public.hcc_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcc_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcc_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcc_innings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcc_ball_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hcc_player_match_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Series public read" ON public.hcc_series FOR SELECT USING (true);
CREATE POLICY "Admins manage series" ON public.hcc_series FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Matches public read" ON public.hcc_matches FOR SELECT USING (true);
CREATE POLICY "Admins manage matches" ON public.hcc_matches FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Fixtures public read" ON public.hcc_fixtures FOR SELECT USING (true);
CREATE POLICY "Admins manage fixtures" ON public.hcc_fixtures FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Innings public read" ON public.hcc_innings FOR SELECT USING (true);
CREATE POLICY "Admins manage innings" ON public.hcc_innings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Ball events public read" ON public.hcc_ball_events FOR SELECT USING (true);
CREATE POLICY "Admins manage ball events" ON public.hcc_ball_events FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Entries public read" ON public.hcc_player_match_entries FOR SELECT USING (true);
CREATE POLICY "Admins manage entries" ON public.hcc_player_match_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));