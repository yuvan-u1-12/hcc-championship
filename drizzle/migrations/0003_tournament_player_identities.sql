CREATE TABLE public.hcc_tournament_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL UNIQUE REFERENCES public.hcc_players(id),
  team_id text NOT NULL REFERENCES public.hcc_teams(id),
  season text NOT NULL DEFAULT 'S1',
  display_name text NOT NULL,
  claim_status text NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed','code_issued','claimed','locked')),
  claim_code_hash text,
  claim_code_issued_at timestamptz,
  claim_code_used_at timestamptz,
  pin_hash text,
  pin_set_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.hcc_tournament_identities IS 'Admin-assigned tournament player identity. Team is set by admin only; claim code and PIN stored as hashes only.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hcc_tournament_identities TO authenticated;
GRANT ALL ON public.hcc_tournament_identities TO service_role;
ALTER TABLE public.hcc_tournament_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tournament identities" ON public.hcc_tournament_identities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER hcc_tournament_identities_updated BEFORE UPDATE ON public.hcc_tournament_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();