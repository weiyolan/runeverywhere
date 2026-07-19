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
      conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          dm_key: string | null
          id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          run_id: string | null
        }
        Insert: {
          created_at?: string
          dm_key?: string | null
          id?: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          run_id?: string | null
        }
        Update: {
          created_at?: string
          dm_key?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      levels: {
        Row: {
          level: number
          min_points: number
          title: string
        }
        Insert: {
          level: number
          min_points: number
          title?: string
        }
        Update: {
          level?: number
          min_points?: number
          title?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          sender_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sender_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          conversation_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          push_checked_at: string | null
          push_sent_at: string | null
          push_tickets: Json | null
          read_at: string | null
          run_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          push_checked_at?: string | null
          push_sent_at?: string | null
          push_tickets?: Json | null
          read_at?: string | null
          run_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          push_checked_at?: string | null
          push_sent_at?: string | null
          push_tickets?: Json | null
          read_at?: string | null
          run_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          id: number
          points: number
          reason: Database["public"]["Enums"]["points_reason"]
          run_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          points: number
          reason: Database["public"]["Enums"]["points_reason"]
          run_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          points?: number
          reason?: Database["public"]["Enums"]["points_reason"]
          run_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
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
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          created_at: string
          id: string
          note: string
          reviewee_id: string
          reviewer_id: string
          run_id: string
          stars: number
          tags: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string
          reviewee_id: string
          reviewer_id: string
          run_id: string
          stars: number
          tags?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          reviewee_id?: string
          reviewer_id?: string
          run_id?: string
          stars?: number
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
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
      run_tracks: {
        Row: {
          avg_pace_s_per_km: number
          created_at: string
          distance_m: number
          duration_s: number
          elevation_gain_m: number
          ended_at: string
          id: string
          polyline: string
          raw_path: string | null
          run_id: string
          sample_count: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          avg_pace_s_per_km: number
          created_at?: string
          distance_m: number
          duration_s: number
          elevation_gain_m?: number
          ended_at: string
          id?: string
          polyline: string
          raw_path?: string | null
          run_id: string
          sample_count?: number | null
          started_at: string
          user_id: string
        }
        Update: {
          avg_pace_s_per_km?: number
          created_at?: string
          distance_m?: number
          duration_s?: number
          elevation_gain_m?: number
          ended_at?: string
          id?: string
          polyline?: string
          raw_path?: string | null
          run_id?: string
          sample_count?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_tracks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_tracks_user_id_fkey"
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
      complete_run: {
        Args: {
          p_distance_m: number
          p_duration_s: number
          p_elevation_gain_m: number
          p_ended_at: string
          p_polyline: string
          p_raw_path?: string | null
          p_run_id: string
          p_started_at: string
        }
        Returns: Json
      }
      compute_points_reward: {
        Args: {
          p_distance_km: number
          p_type: Database["public"]["Enums"]["run_type"]
        }
        Returns: number
      }
      get_or_create_dm: {
        Args: { p_other_user: string }
        Returns: string
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
      is_conversation_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
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
      list_conversations: {
        Args: Record<PropertyKey, never>
        Returns: {
          conversation_id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_at: string | null
          last_body: string | null
          last_kind: Database["public"]["Enums"]["message_kind"] | null
          last_sender_id: string | null
          member_count: number
          peer_avatars: string[]
          peer_ids: string[]
          peer_names: string[]
          run_id: string | null
          run_type: Database["public"]["Enums"]["run_type"] | null
          starts_at: string | null
          title: string
          unread_count: number
        }[]
      }
      list_past_runs: {
        Args: Record<PropertyKey, never>
        Returns: {
          area_name: string
          city: string
          distance_km: number
          my_rating_given: number | null
          peer_avatars: string[]
          peer_names: string[]
          points_earned: number
          run_id: string
          starts_at: string
          title: string
          track_avg_pace_s_per_km: number | null
          track_distance_m: number | null
          track_duration_s: number | null
          track_elevation_gain_m: number | null
          track_id: string | null
          type: Database["public"]["Enums"]["run_type"]
        }[]
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
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
      set_home_location: {
        Args: { p_city: string; p_lat: number; p_lng: number }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_review: {
        Args: {
          p_note?: string
          p_reviewee_id: string
          p_run_id: string
          p_stars: number
          p_tags?: string[]
        }
        Returns: Json
      }
      uuid_or_null: {
        Args: { p: string }
        Returns: string
      }
    }
    Enums: {
      conversation_kind: "run" | "dm"
      distance_band: "short" | "mid" | "long" | "ultra"
      member_status:
        "pending" | "approved" | "declined" | "cancelled" | "removed"
      message_kind: "user" | "system" | "meeting_point"
      notification_kind:
        "join_request" | "request_approved" | "request_declined" |
        "member_joined" | "message" | "run_reminder" | "run_completed" |
        "review_received"
      pace_band: "easy" | "steady" | "quick" | "fast"
      points_reason: "finished" | "distance_goal" | "on_time" | "rate_crew"
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
      conversation_kind: ["run", "dm"],
      distance_band: ["short", "mid", "long", "ultra"],
      member_status: [
        "pending",
        "approved",
        "declined",
        "cancelled",
        "removed",
      ],
      message_kind: ["user", "system", "meeting_point"],
      notification_kind: [
        "join_request",
        "request_approved",
        "request_declined",
        "member_joined",
        "message",
        "run_reminder",
        "run_completed",
        "review_received",
      ],
      pace_band: ["easy", "steady", "quick", "fast"],
      points_reason: ["finished", "distance_goal", "on_time", "rate_crew"],
      profile_visibility: ["everyone", "members", "hidden"],
      run_status: ["published", "cancelled", "completed"],
      run_type: ["discover", "challenge", "social"],
      run_visibility: ["open", "approval", "invite"],
      units_pref: ["km", "mi"],
    },
  },
} as const

