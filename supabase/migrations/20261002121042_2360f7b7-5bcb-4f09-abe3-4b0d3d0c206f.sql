ALTER TABLE public.hcc_teams ADD COLUMN captain_player_id text REFERENCES public.hcc_players(id) ON DELETE SET NULL;
UPDATE public.hcc_teams t SET captain_player_id = (SELECT p.id FROM public.hcc_players p WHERE p.team_id = t.id AND p.is_captain ORDER BY p.squad_order LIMIT 1);
ALTER TABLE public.hcc_teams ADD CONSTRAINT hcc_teams_captain_unique UNIQUE (captain_player_id);
ALTER TABLE public.hcc_players DROP COLUMN risk;
ALTER TABLE public.hcc_players DROP COLUMN is_captain;
UPDATE public.hcc_players p SET captaincy = NULL WHERE captaincy IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.hcc_teams t WHERE t.captain_player_id = p.id);

CREATE OR REPLACE FUNCTION public.hcc_validate_captaincy() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.captaincy IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.hcc_teams t WHERE t.captain_player_id = NEW.id AND t.id = NEW.team_id) THEN
    RAISE EXCEPTION 'Captaincy rating is only allowed for the team''s designated captain';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hcc_players_validate_captaincy BEFORE INSERT OR UPDATE ON public.hcc_players FOR EACH ROW EXECUTE FUNCTION public.hcc_validate_captaincy();

CREATE OR REPLACE FUNCTION public.hcc_validate_team_captain() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.captain_player_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.hcc_players p WHERE p.id = NEW.captain_player_id AND p.team_id = NEW.id) THEN
    RAISE EXCEPTION 'Captain must belong to this team';
  END IF;
  IF OLD.captain_player_id IS DISTINCT FROM NEW.captain_player_id AND OLD.captain_player_id IS NOT NULL THEN
    UPDATE public.hcc_players SET captaincy = NULL WHERE id = OLD.captain_player_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hcc_teams_validate_captain BEFORE UPDATE ON public.hcc_teams FOR EACH ROW EXECUTE FUNCTION public.hcc_validate_team_captain();