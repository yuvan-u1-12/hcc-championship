export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      hcc_ball_events: {
        Row: {
          ball_no: number
          bat_number: number
          batting_team_id: string
          bowl_number: number
          bowler_id: string
          bowling_team_id: string
          id: string
          innings_no: number
          is_square: boolean
          is_wicket: boolean
          match_id: string
          non_striker_id: string | null
          over_no: number
          phase: string
          recorded_at: string
          runs: number
          striker_id: string
        }
        Insert: {
          ball_no: number
          bat_number: number
          batting_team_id: string
          bowl_number: number
          bowler_id: string
          bowling_team_id: string
          id: string
          innings_no: number
          is_square?: boolean
          is_wicket?: boolean
          match_id: string
          non_striker_id?: string | null
          over_no: number
          phase: string
          recorded_at?: string
          runs: number
          striker_id: string
        }
        Update: {
          ball_no?: number
          bat_number?: number
          batting_team_id?: string
          bowl_number?: number
          bowler_id?: string
          bowling_team_id?: string
          id?: string
          innings_no?: number
          is_square?: boolean
          is_wicket?: boolean
          match_id?: string
          non_striker_id?: string | null
          over_no?: number
          phase?: string
          recorded_at?: string
          runs?: number
          striker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hcc_ball_events_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_ball_events_bowler_id_fkey"
            columns: ["bowler_id"]
            isOneToOne: false
            referencedRelation: "hcc_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_ball_events_bowling_team_id_fkey"
            columns: ["bowling_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_ball_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "hcc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_ball_events_non_striker_id_fkey"
            columns: ["non_striker_id"]
            isOneToOne: false
            referencedRelation: "hcc_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_ball_events_striker_id_fkey"
            columns: ["striker_id"]
            isOneToOne: false
            referencedRelation: "hcc_players"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_fixtures: {
        Row: {
          approved: boolean
          away_team_id: string
          created_at: string
          home_team_id: string
          id: string
          match_id: string | null
          scheduled_at: string | null
          series_id: string | null
          venue: string | null
        }
        Insert: {
          approved?: boolean
          away_team_id: string
          created_at?: string
          home_team_id: string
          id?: string
          match_id?: string | null
          scheduled_at?: string | null
          series_id?: string | null
          venue?: string | null
        }
        Update: {
          approved?: boolean
          away_team_id?: string
          created_at?: string
          home_team_id?: string
          id?: string
          match_id?: string | null
          scheduled_at?: string | null
          series_id?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcc_fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_fixtures_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "hcc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_fixtures_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "hcc_series"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_innings: {
        Row: {
          all_out: boolean
          batting_team_id: string
          bowling_team_id: string
          declared: boolean
          innings_no: number
          legal_balls: number
          match_id: string
          runs: number
          wickets: number
        }
        Insert: {
          all_out?: boolean
          batting_team_id: string
          bowling_team_id: string
          declared?: boolean
          innings_no: number
          legal_balls?: number
          match_id: string
          runs?: number
          wickets?: number
        }
        Update: {
          all_out?: boolean
          batting_team_id?: string
          bowling_team_id?: string
          declared?: boolean
          innings_no?: number
          legal_balls?: number
          match_id?: string
          runs?: number
          wickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "hcc_innings_batting_team_id_fkey"
            columns: ["batting_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_innings_bowling_team_id_fkey"
            columns: ["bowling_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_innings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "hcc_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_matches: {
        Row: {
          away_team_id: string
          completed_at: string | null
          created_at: string
          fixture_id: string | null
          home_team_id: string
          id: string
          is_official: boolean
          match_type: string
          played_at: string
          result_text: string | null
          result_type: string | null
          room_code: string | null
          series_id: string | null
          source: string
          status: string
          toss_choice: string | null
          toss_winner_team_id: string | null
          venue: string | null
          winner_team_id: string | null
        }
        Insert: {
          away_team_id: string
          completed_at?: string | null
          created_at?: string
          fixture_id?: string | null
          home_team_id: string
          id: string
          is_official?: boolean
          match_type?: string
          played_at?: string
          result_text?: string | null
          result_type?: string | null
          room_code?: string | null
          series_id?: string | null
          source?: string
          status?: string
          toss_choice?: string | null
          toss_winner_team_id?: string | null
          venue?: string | null
          winner_team_id?: string | null
        }
        Update: {
          away_team_id?: string
          completed_at?: string | null
          created_at?: string
          fixture_id?: string | null
          home_team_id?: string
          id?: string
          is_official?: boolean
          match_type?: string
          played_at?: string
          result_text?: string | null
          result_type?: string | null
          room_code?: string | null
          series_id?: string | null
          source?: string
          status?: string
          toss_choice?: string | null
          toss_winner_team_id?: string | null
          venue?: string | null
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hcc_matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_matches_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "hcc_fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_matches_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "hcc_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_matches_toss_winner_team_id_fkey"
            columns: ["toss_winner_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_matches_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_player_match_entries: {
        Row: {
          balls_bowled: number | null
          balls_faced: number | null
          dismissed: boolean | null
          dismissed_by_id: string | null
          id: string
          innings_no: number
          match_id: string
          player_id: string
          runs: number | null
          runs_conceded: number | null
          team_id: string
          wickets: number | null
        }
        Insert: {
          balls_bowled?: number | null
          balls_faced?: number | null
          dismissed?: boolean | null
          dismissed_by_id?: string | null
          id?: string
          innings_no: number
          match_id: string
          player_id: string
          runs?: number | null
          runs_conceded?: number | null
          team_id: string
          wickets?: number | null
        }
        Update: {
          balls_bowled?: number | null
          balls_faced?: number | null
          dismissed?: boolean | null
          dismissed_by_id?: string | null
          id?: string
          innings_no?: number
          match_id?: string
          player_id?: string
          runs?: number | null
          runs_conceded?: number | null
          team_id?: string
          wickets?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hcc_player_match_entries_dismissed_by_id_fkey"
            columns: ["dismissed_by_id"]
            isOneToOne: false
            referencedRelation: "hcc_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_player_match_entries_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "hcc_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_player_match_entries_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "hcc_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_player_match_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_players: {
        Row: {
          base_ovr: number | null
          captaincy: number | null
          confidence: number | null
          created_at: string
          current_ovr: number | null
          fielding: number | null
          home_venue: string | null
          id: string
          is_vice_captain: boolean
          name: string
          ratings_are_placeholder: boolean
          role: string
          squad_order: number
          team_id: string | null
          updated_at: string
        }
        Insert: {
          base_ovr?: number | null
          captaincy?: number | null
          confidence?: number | null
          created_at?: string
          current_ovr?: number | null
          fielding?: number | null
          home_venue?: string | null
          id: string
          is_vice_captain?: boolean
          name: string
          ratings_are_placeholder?: boolean
          role: string
          squad_order?: number
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          base_ovr?: number | null
          captaincy?: number | null
          confidence?: number | null
          created_at?: string
          current_ovr?: number | null
          fielding?: number | null
          home_venue?: string | null
          id?: string
          is_vice_captain?: boolean
          name?: string
          ratings_are_placeholder?: boolean
          role?: string
          squad_order?: number
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hcc_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_series: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          parent_id: string | null
          season: string
        }
        Insert: {
          created_at?: string
          id: string
          kind?: string
          name: string
          parent_id?: string | null
          season?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          season?: string
        }
        Relationships: [
          {
            foreignKeyName: "hcc_series_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "hcc_series"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_teams: {
        Row: {
          accent: string | null
          captain_player_id: string | null
          color: string | null
          created_at: string
          id: string
          name: string
          season: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          accent?: string | null
          captain_player_id?: string | null
          color?: string | null
          created_at?: string
          id: string
          name: string
          season?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          accent?: string | null
          captain_player_id?: string | null
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          season?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hcc_teams_captain_player_id_fkey"
            columns: ["captain_player_id"]
            isOneToOne: true
            referencedRelation: "hcc_players"
            referencedColumns: ["id"]
          },
        ]
      }
      hcc_tournament_identities: {
        Row: {
          claim_code_hash: string | null
          claim_code_issued_at: string | null
          claim_code_used_at: string | null
          claim_status: string
          claimed_at: string | null
          created_at: string
          display_name: string
          id: string
          pin_hash: string | null
          pin_set_at: string | null
          player_id: string
          season: string
          team_id: string
          updated_at: string
        }
        Insert: {
          claim_code_hash?: string | null
          claim_code_issued_at?: string | null
          claim_code_used_at?: string | null
          claim_status?: string
          claimed_at?: string | null
          created_at?: string
          display_name: string
          id?: string
          pin_hash?: string | null
          pin_set_at?: string | null
          player_id: string
          season?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          claim_code_hash?: string | null
          claim_code_issued_at?: string | null
          claim_code_used_at?: string | null
          claim_status?: string
          claimed_at?: string | null
          created_at?: string
          display_name?: string
          id?: string
          pin_hash?: string | null
          pin_set_at?: string | null
          player_id?: string
          season?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hcc_tournament_identities_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "hcc_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hcc_tournament_identities_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "hcc_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
