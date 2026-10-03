# Architecture rules
- Player/team master data lives in `hcc_players` / `hcc_teams` with stable text IDs (`TEAMID-name-slug`); historical records must reference these IDs, not names. Why: Season 2 data will replace S1 names.
- Rating attributes are nullable and not used by the game engine until formulas are explicitly specified. Why: HCC spec forbids invented formulas.
- Gameplay still reads squads from `src/lib/teams.ts`; keep it in sync with `hcc_players` until migrated. Why: preserves working match engine.
- Team captaincy is a team-level link (`hcc_teams.captain_player_id`, unique) with DB triggers enforcing captaincy ratings only on the designated captain. Why: one captain per team, role stays the cricket role.
- Live matches persist to `hcc_matches` / `hcc_innings` / `hcc_ball_events` via the host client calling `recordMatchProgress` after the engine resolves each ball; ids are `ROOM-matchStartedAt` and `match:inn:over:ball`, inserts ignore duplicates. Why: engine stays source of truth, events are idempotent across refresh/reconnect.
- Historical matches use the same `hcc_matches`/`hcc_innings` tables (`source='historical'`) with per-innings player lines in `hcc_player_match_entries`; stats must union these with ball-event aggregates. Why: one stats system for live and legacy data.
