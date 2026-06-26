
CREATE TYPE public.match_phase AS ENUM ('Normal', 'Crazy');

CREATE TABLE public.match_player_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL,
  player_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  phase public.match_phase NOT NULL,
  runs_scored INT NOT NULL DEFAULT 0,
  outs INT NOT NULL DEFAULT 0,
  low_boundaries INT NOT NULL DEFAULT 0,
  high_boundaries INT NOT NULL DEFAULT 0,
  ten_squares INT NOT NULL DEFAULT 0,
  balls_bowled INT NOT NULL DEFAULT 0,
  runs_conceded INT NOT NULL DEFAULT 0,
  wickets INT NOT NULL DEFAULT 0,
  maidens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mpl_match ON public.match_player_logs(match_id);
CREATE INDEX idx_mpl_player ON public.match_player_logs(player_name);

GRANT SELECT, INSERT ON public.match_player_logs TO anon;
GRANT SELECT, INSERT ON public.match_player_logs TO authenticated;
GRANT ALL ON public.match_player_logs TO service_role;

ALTER TABLE public.match_player_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read match logs"
  ON public.match_player_logs FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert match logs"
  ON public.match_player_logs FOR INSERT
  WITH CHECK (true);
