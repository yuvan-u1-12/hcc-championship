# Architecture rules
- Player/team master data lives in `hcc_players` / `hcc_teams` with stable text IDs (`TEAMID-name-slug`); historical records must reference these IDs, not names. Why: Season 2 data will replace S1 names.
- Rating attributes are nullable and not used by the game engine until formulas are explicitly specified. Why: HCC spec forbids invented formulas.
- Gameplay still reads squads from `src/lib/teams.ts`; keep it in sync with `hcc_players` until migrated. Why: preserves working match engine.
- Team captaincy is a team-level link (`hcc_teams.captain_player_id`, unique) with DB triggers enforcing captaincy ratings only on the designated captain. Why: one captain per team, role stays the cricket role.
