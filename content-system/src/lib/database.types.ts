export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          default_edit_cost_cents: number
          id: boolean
          revision_allowance: number | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          default_edit_cost_cents?: number
          id?: boolean
          revision_allowance?: number | null
          updated_at?: string
        }
        Update: {
          default_edit_cost_cents?: number
          id?: boolean
          revision_allowance?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          at: string
          client_id: string | null
          details: NonNullable<Json>
          id: number
          record_id: string | null
          table_name: string
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          at?: string
          client_id?: string | null
          details?: NonNullable<Json>
          id?: never
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          at?: string
          client_id?: string | null
          details?: NonNullable<Json>
          id?: never
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      client_financials: {
        Row: {
          client_id: string
          notes: string
          price_per_video_cents: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          client_id: string
          notes?: string
          price_per_video_cents?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          notes?: string
          price_per_video_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_financials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
        }
        ComputedFields: never
        Insert: {
          body: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          assigned_team_member: string | null
          business: string
          created_at: string
          id: string
          login_contact: string
          name: string
          niche_tags: string[]
          platforms: string[]
          posting_cadence: string
          posting_days: string[]
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          assigned_team_member?: string | null
          business?: string
          created_at?: string
          id?: string
          login_contact?: string
          name: string
          niche_tags?: string[]
          platforms?: string[]
          posting_cadence?: string
          posting_days?: string[]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          assigned_team_member?: string | null
          business?: string
          created_at?: string
          id?: string
          login_contact?: string
          name?: string
          niche_tags?: string[]
          platforms?: string[]
          posting_cadence?: string
          posting_days?: string[]
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_team_member_fkey"
            columns: ["assigned_team_member"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      footage_uploads: {
        Row: {
          check_status: Database["public"]["Enums"]["footage_check"]
          checked_at: string | null
          client_id: string
          duration_seconds: number | null
          flags: string[]
          has_audio: boolean | null
          height: number | null
          id: string
          original_name: string
          script_id: string
          shot_id: string
          shot_number: number
          size_bytes: number | null
          storage_path: string
          superseded: boolean
          uploaded_at: string
          uploaded_by: string | null
          width: number | null
        }
        ComputedFields: never
        Insert: {
          check_status?: Database["public"]["Enums"]["footage_check"]
          checked_at?: string | null
          client_id: string
          duration_seconds?: number | null
          flags?: string[]
          has_audio?: boolean | null
          height?: number | null
          id?: string
          original_name?: string
          script_id: string
          shot_id: string
          shot_number?: number
          size_bytes?: number | null
          storage_path: string
          superseded?: boolean
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          check_status?: Database["public"]["Enums"]["footage_check"]
          checked_at?: string | null
          client_id?: string
          duration_seconds?: number | null
          flags?: string[]
          has_audio?: boolean | null
          height?: number | null
          id?: string
          original_name?: string
          script_id?: string
          shot_id?: string
          shot_number?: number
          size_bytes?: number | null
          storage_path?: string
          superseded?: boolean
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "footage_uploads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "footage_uploads_script_id_client_id_fkey"
            columns: ["script_id", "client_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id", "client_id"]
          },
          {
            foreignKeyName: "footage_uploads_shot_id_script_id_fkey"
            columns: ["shot_id", "script_id"]
            isOneToOne: false
            referencedRelation: "shots"
            referencedColumns: ["id", "script_id"]
          },
          {
            foreignKeyName: "footage_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          notification_prefs: NonNullable<Json>
          role: Database["public"]["Enums"]["app_role"]
        }
        ComputedFields: never
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          notification_prefs?: NonNullable<Json>
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          notification_prefs?: NonNullable<Json>
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      script_comments: {
        Row: {
          author_id: string | null
          body: string
          client_id: string
          created_at: string
          id: string
          kind: string
          script_id: string
        }
        ComputedFields: never
        Insert: {
          author_id?: string | null
          body: string
          client_id: string
          created_at?: string
          id?: string
          kind?: string
          script_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          kind?: string
          script_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_comments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_comments_script_id_client_id_fkey"
            columns: ["script_id", "client_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id", "client_id"]
          },
        ]
      }
      script_internal: {
        Row: {
          ai_drafted: boolean
          client_id: string
          footage_reminders_sent: number
          hook_id: string | null
          internal_notes: string
          last_reminder_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          script_id: string
          source_research_item_id: string | null
          style_notes: string
        }
        ComputedFields: never
        Insert: {
          ai_drafted?: boolean
          client_id: string
          footage_reminders_sent?: number
          hook_id?: string | null
          internal_notes?: string
          last_reminder_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          script_id: string
          source_research_item_id?: string | null
          style_notes?: string
        }
        Update: {
          ai_drafted?: boolean
          client_id?: string
          footage_reminders_sent?: number
          hook_id?: string | null
          internal_notes?: string
          last_reminder_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          script_id?: string
          source_research_item_id?: string | null
          style_notes?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_internal_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_internal_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "script_internal_script_id_client_id_fkey"
            columns: ["script_id", "client_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id", "client_id"]
          },
        ]
      }
      scripts: {
        Row: {
          body: string
          client_approved: boolean
          client_approved_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          delivered_at: string | null
          footage_received_at: string | null
          footage_requested_at: string | null
          format: Database["public"]["Enums"]["video_format"]
          hook: string
          id: string
          posted_at: string | null
          sent_at: string | null
          stage: Database["public"]["Enums"]["script_stage"]
          title: string
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          body?: string
          client_approved?: boolean
          client_approved_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          footage_received_at?: string | null
          footage_requested_at?: string | null
          format?: Database["public"]["Enums"]["video_format"]
          hook?: string
          id?: string
          posted_at?: string | null
          sent_at?: string | null
          stage?: Database["public"]["Enums"]["script_stage"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          client_approved?: boolean
          client_approved_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          footage_received_at?: string | null
          footage_requested_at?: string | null
          format?: Database["public"]["Enums"]["video_format"]
          hook?: string
          id?: string
          posted_at?: string | null
          sent_at?: string | null
          stage?: Database["public"]["Enums"]["script_stage"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shooting_briefs: {
        Row: {
          client_id: string
          due_date: string | null
          notes: string
          reference_url: string
          script_id: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          client_id: string
          due_date?: string | null
          notes?: string
          reference_url?: string
          script_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          due_date?: string | null
          notes?: string
          reference_url?: string
          script_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shooting_briefs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shooting_briefs_script_id_client_id_fkey"
            columns: ["script_id", "client_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id", "client_id"]
          },
        ]
      }
      shots: {
        Row: {
          client_id: string
          framing: string
          id: string
          instruction: string
          lighting_notes: string
          lines: string
          min_duration_seconds: number
          orientation: Database["public"]["Enums"]["shot_orientation"]
          script_id: string
          shot_number: number
          where_to_look: string
        }
        ComputedFields: never
        Insert: {
          client_id: string
          framing?: string
          id?: string
          instruction?: string
          lighting_notes?: string
          lines?: string
          min_duration_seconds?: number
          orientation?: Database["public"]["Enums"]["shot_orientation"]
          script_id: string
          shot_number: number
          where_to_look?: string
        }
        Update: {
          client_id?: string
          framing?: string
          id?: string
          instruction?: string
          lighting_notes?: string
          lines?: string
          min_duration_seconds?: number
          orientation?: Database["public"]["Enums"]["shot_orientation"]
          script_id?: string
          shot_number?: number
          where_to_look?: string
        }
        Relationships: [
          {
            foreignKeyName: "shots_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shots_script_id_client_id_fkey"
            columns: ["script_id", "client_id"]
            isOneToOne: false
            referencedRelation: "scripts"
            referencedColumns: ["id", "client_id"]
          },
        ]
      }
      voice_corrections: {
        Row: {
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
        }
        ComputedFields: never
        Insert: {
          body: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_corrections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_corrections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_corrections_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_profiles: {
        Row: {
          audience: string
          client_id: string
          created_at: string
          example_posts: NonNullable<Json>
          intake_answers: NonNullable<Json>
          interview_source: string
          interview_transcript: string
          offer: string
          phrases_never: string[]
          phrases_use: string[]
          summary: string
          summary_sent_at: string | null
          tone_notes: string
          topics_avoid: string[]
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          audience?: string
          client_id: string
          created_at?: string
          example_posts?: NonNullable<Json>
          intake_answers?: NonNullable<Json>
          interview_source?: string
          interview_transcript?: string
          offer?: string
          phrases_never?: string[]
          phrases_use?: string[]
          summary?: string
          summary_sent_at?: string | null
          tone_notes?: string
          topics_avoid?: string[]
          updated_at?: string
        }
        Update: {
          audience?: string
          client_id?: string
          created_at?: string
          example_posts?: NonNullable<Json>
          intake_answers?: NonNullable<Json>
          interview_source?: string
          interview_transcript?: string
          offer?: string
          phrases_never?: string[]
          phrases_use?: string[]
          summary?: string
          summary_sent_at?: string | null
          tone_notes?: string
          topics_avoid?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      client_approve_script: {
        Args: { p_script_id: string }
        Returns: undefined
      }
      client_request_changes: {
        Args: { p_comment: string; p_script_id: string }
        Returns: undefined
      }
      log_event: {
        Args: {
          p_action: string
          p_client_id: string
          p_details?: Json
          p_record_id: string
          p_table: string
        }
        Returns: undefined
      }
      my_voice_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          audience: string
          offer: string
          phrases_never: string[]
          phrases_use: string[]
          summary: string
          topics_avoid: string[]
          updated_at: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "team" | "editor" | "client"
      client_status: "onboarding" | "active" | "paused" | "offboarded"
      footage_check: "pending" | "passed" | "failed"
      script_stage:
        | "research"
        | "scripted"
        | "sent_to_client"
        | "approved"
        | "awaiting_footage"
        | "footage_received"
        | "in_edit"
        | "review"
        | "delivered"
        | "posted"
      shot_orientation: "portrait" | "landscape"
      video_format:
        | "talking_head"
        | "voiceover_broll"
        | "skit"
        | "listicle"
        | "reaction"
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
      app_role: ["admin", "team", "editor", "client"],
      client_status: ["onboarding", "active", "paused", "offboarded"],
      footage_check: ["pending", "passed", "failed"],
      script_stage: [
        "research",
        "scripted",
        "sent_to_client",
        "approved",
        "awaiting_footage",
        "footage_received",
        "in_edit",
        "review",
        "delivered",
        "posted",
      ],
      shot_orientation: ["portrait", "landscape"],
      video_format: [
        "talking_head",
        "voiceover_broll",
        "skit",
        "listicle",
        "reaction",
      ],
    },
  },
} as const
