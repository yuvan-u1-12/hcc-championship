
CREATE TABLE public.match_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  winner text,
  loser text,
  potm text,
  won_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.match_history TO anon, authenticated;
GRANT ALL ON public.match_history TO service_role;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read match history" ON public.match_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert match history" ON public.match_history FOR INSERT WITH CHECK (true);

CREATE TABLE public.innings_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL,
  batting_team text NOT NULL,
  bowling_team text NOT NULL,
  inn1_score text,
  inn2_score text,
  inn3_score text,
  inn4_score text,
  match_aggregate integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.innings_data TO anon, authenticated;
GRANT ALL ON public.innings_data TO service_role;
ALTER TABLE public.innings_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read innings data" ON public.innings_data FOR SELECT USING (true);
CREATE POLICY "Anyone can insert innings data" ON public.innings_data FOR INSERT WITH CHECK (true);

CREATE INDEX idx_match_history_match_id ON public.match_history(match_id);
CREATE INDEX idx_innings_data_match_id ON public.innings_data(match_id);
