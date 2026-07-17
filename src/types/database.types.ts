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
    PostgrestVersion: "14.14"
  }
  public: {
    Tables: {
      favorites: {
        Row: {
          created_at: string
          run_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          run_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          created_at: string
          display_name: string
          distance_band: Database["public"]["Enums"]["distance_band"] | null
          home_city: string | null
          home_point: unknown
          id: string
          languages: string[]
          level: number
          onboarded_at: string | null
          pace_band: Database["public"]["Enums"]["pace_band"] | null
          points_total: number
          rating_avg: number | null
          rating_count: number
          tos_accepted_at: string | null
          units: Database["public"]["Enums"]["units_pref"]
          updated_at: string
          visibility: Database["public"]["Enums"]["profile_visibility"]
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          distance_band?: Database["public"]["Enums"]["distance_band"] | null
          home_city?: string | null
          home_point?: unknown
          id: string
          languages?: string[]
          level?: number
          onboarded_at?: string | null
          pace_band?: Database["public"]["Enums"]["pace_band"] | null
          points_total?: number
          rating_avg?: number | null
          rating_count?: number
          tos_accepted_at?: string | null
          units?: Database["public"]["Enums"]["units_pref"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          created_at?: string
          display_name?: string
          distance_band?: Database["public"]["Enums"]["distance_band"] | null
          home_city?: string | null
          home_point?: unknown
          id?: string
          languages?: string[]
          level?: number
          onboarded_at?: string | null
          pace_band?: Database["public"]["Enums"]["pace_band"] | null
          points_total?: number
          rating_avg?: number | null
          rating_count?: number
          tos_accepted_at?: string | null
          units?: Database["public"]["Enums"]["units_pref"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["profile_visibility"]
        }
        Relationships: []
      }
      run_members: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          intro_message: string
          requested_at: string
          run_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          intro_message?: string
          requested_at?: string
          run_id: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          intro_message?: string
          requested_at?: string
          run_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_members_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_members_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          area_name: string
          city: string
          closed_loop: boolean
          country_code: string
          created_at: string
          distance_km: number
          goal: string
          host_id: string
          id: string
          invite_code: string | null
          max_group: number
          points_reward: number
          start_point: unknown
          starts_at: string
          status: Database["public"]["Enums"]["run_status"]
          target_pace_s_per_km: number | null
          title: string
          type: Database["public"]["Enums"]["run_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["run_visibility"]
        }
        Insert: {
          area_name?: string
          city?: string
          closed_loop?: boolean
          country_code?: string
          created_at?: string
          distance_km: number
          goal?: string
          host_id: string
          id?: string
          invite_code?: string | null
          max_group: number
          points_reward?: number
          start_point: unknown
          starts_at: string
          status?: Database["public"]["Enums"]["run_status"]
          target_pace_s_per_km?: number | null
          title: string
          type: Database["public"]["Enums"]["run_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["run_visibility"]
        }
        Update: {
          area_name?: string
          city?: string
          closed_loop?: boolean
          country_code?: string
          created_at?: string
          distance_km?: number
          goal?: string
          host_id?: string
          id?: string
          invite_code?: string | null
          max_group?: number
          points_reward?: number
          start_point?: unknown
          starts_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          target_pace_s_per_km?: number | null
          title?: string
          type?: Database["public"]["Enums"]["run_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["run_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "runs_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_join: {
        Args: { p_run_id: string }
        Returns: {
          decided_at: string | null
          decided_by: string | null
          intro_message: string
          requested_at: string
          run_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "run_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      compute_points_reward: {
        Args: {
          p_distance_km: number
          p_type: Database["public"]["Enums"]["run_type"]
        }
        Returns: number
      }
      get_run_by_invite: {
        Args: { p_code: string }
        Returns: {
          area_name: string
          city: string
          closed_loop: boolean
          country_code: string
          created_at: string
          distance_km: number
          goal: string
          host_id: string
          id: string
          invite_code: string | null
          max_group: number
          points_reward: number
          start_point: unknown
          starts_at: string
          status: Database["public"]["Enums"]["run_status"]
          target_pace_s_per_km: number | null
          title: string
          type: Database["public"]["Enums"]["run_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["run_visibility"]
        }[]
        SetofOptions: {
          from: "*"
          to: "runs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_run_member: {
        Args: { p_run_id: string; p_user_id: string }
        Returns: boolean
      }
      join_run: {
        Args: { p_intro_message?: string; p_run_id: string }
        Returns: {
          decided_at: string | null
          decided_by: string | null
          intro_message: string
          requested_at: string
          run_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "run_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_member: {
        Args: { p_run_id: string; p_user_id: string }
        Returns: {
          decided_at: string | null
          decided_by: string | null
          intro_message: string
          requested_at: string
          run_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "run_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_join_request: {
        Args: { p_approve: boolean; p_run_id: string; p_user_id: string }
        Returns: {
          decided_at: string | null
          decided_by: string | null
          intro_message: string
          requested_at: string
          run_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "run_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_approved_count: {
        Args: { p_run_id: string }
        Returns: number
      }
      runs_within_radius: {
        Args: {
          p_closed_loop?: boolean
          p_from?: string
          p_lat: number
          p_lng: number
          p_only_open_spots?: boolean
          p_radius_m?: number
          p_to?: string
          p_types?: Database["public"]["Enums"]["run_type"][]
        }
        Returns: {
          approved_count: number
          distance_m: number
          run: Database["public"]["Tables"]["runs"]["Row"]
        }[]
      }
      search_runs: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_query: string
        }
        Returns: {
          approved_count: number
          distance_m: number
          run: Database["public"]["Tables"]["runs"]["Row"]
        }[]
      }
    }
    Enums: {
      distance_band: "short" | "mid" | "long" | "ultra"
      member_status:
        "pending" | "approved" | "declined" | "cancelled" | "removed"
      pace_band: "easy" | "steady" | "quick" | "fast"
      profile_visibility: "everyone" | "members" | "hidden"
      run_status: "published" | "cancelled" | "completed"
      run_type: "discover" | "challenge" | "social"
      run_visibility: "open" | "approval" | "invite"
      units_pref: "km" | "mi"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
      distance_band: ["short", "mid", "long", "ultra"],
      member_status: [
        "pending",
        "approved",
        "declined",
        "cancelled",
        "removed",
      ],
      pace_band: ["easy", "steady", "quick", "fast"],
      profile_visibility: ["everyone", "members", "hidden"],
      run_status: ["published", "cancelled", "completed"],
      run_type: ["discover", "challenge", "social"],
      run_visibility: ["open", "approval", "invite"],
      units_pref: ["km", "mi"],
    },
  },
} as const

