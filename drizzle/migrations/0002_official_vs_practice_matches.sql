ALTER TABLE public.hcc_fixtures ADD COLUMN approved boolean NOT NULL DEFAULT false;
ALTER TABLE public.hcc_matches ADD COLUMN match_type text NOT NULL DEFAULT 'practice';
ALTER TABLE public.hcc_matches ADD COLUMN is_official boolean NOT NULL DEFAULT false;
ALTER TABLE public.hcc_matches ADD COLUMN fixture_id uuid REFERENCES public.hcc_fixtures(id);
CREATE UNIQUE INDEX hcc_matches_fixture_id_unique ON public.hcc_matches(fixture_id) WHERE fixture_id IS NOT NULL;
ALTER TABLE public.hcc_matches ADD CONSTRAINT hcc_matches_official_consistency CHECK (
  (is_official AND match_type = 'official' AND fixture_id IS NOT NULL)
  OR (NOT is_official AND match_type = 'practice')
);
CREATE OR REPLACE FUNCTION public.hcc_validate_official_match()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_official THEN
    IF NOT EXISTS (SELECT 1 FROM public.hcc_fixtures f WHERE f.id = NEW.fixture_id AND f.approved) THEN
      RAISE EXCEPTION 'Official matches must link to an approved fixture';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hcc_matches_validate_official BEFORE INSERT OR UPDATE ON public.hcc_matches
FOR EACH ROW EXECUTE FUNCTION public.hcc_validate_official_match();
COMMENT ON COLUMN public.hcc_matches.is_official IS 'Only true when linked to an admin-approved fixture; practice matches never count toward official data.';