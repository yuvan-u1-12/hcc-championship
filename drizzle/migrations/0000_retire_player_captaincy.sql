UPDATE public.hcc_players SET captaincy = NULL WHERE captaincy IS NOT NULL;
ALTER TABLE public.hcc_players ADD CONSTRAINT hcc_players_no_captaincy CHECK (captaincy IS NULL);
COMMENT ON COLUMN public.hcc_players.captaincy IS 'DEPRECATED: captaincy is team-level via hcc_teams.captain_player_id; must stay NULL';