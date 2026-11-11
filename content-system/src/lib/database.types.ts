
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "default_edit_cost_cents": number,"id": boolean,"revision_allowance": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "default_edit_cost_cents"?: number,"id"?: boolean,"revision_allowance"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "default_edit_cost_cents"?: number,"id"?: boolean,"revision_allowance"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string | null,"at": string,"client_id": string | null,"details": NonNullable<Json>,"id": number,"record_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role"?: string | null,"at"?: string,"client_id"?: string | null,"details"?: NonNullable<Json>,"id"?: never,"record_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string | null,"at"?: string,"client_id"?: string | null,"details"?: NonNullable<Json>,"id"?: never,"record_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"client_financials": {
                  Row: {
                    "client_id": string,"notes": string,"price_per_video_cents": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id": string,"notes"?: string,"price_per_video_cents"?: number,"updated_at"?: string
                  }
                  Update: {
                    "client_id"?: string,"notes"?: string,"price_per_video_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_financials_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"client_notes": {
                  Row: {
                    "body": string,"client_id": string,"created_at": string,"created_by": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string
                  }
                  Update: {
                    "body"?: string,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_notes_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_notes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "assigned_team_member": string | null,"business": string,"created_at": string,"id": string,"login_contact": string,"name": string,"niche_tags": (string)[],"platforms": (string)[],"posting_cadence": string,"posting_days": (string)[],"status": Database["public"]['Enums']["client_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_team_member"?: string | null,"business"?: string,"created_at"?: string,"id"?: string,"login_contact"?: string,"name": string,"niche_tags"?: (string)[],"platforms"?: (string)[],"posting_cadence"?: string,"posting_days"?: (string)[],"status"?: Database["public"]['Enums']["client_status"],"updated_at"?: string
                  }
                  Update: {
                    "assigned_team_member"?: string | null,"business"?: string,"created_at"?: string,"id"?: string,"login_contact"?: string,"name"?: string,"niche_tags"?: (string)[],"platforms"?: (string)[],"posting_cadence"?: string,"posting_days"?: (string)[],"status"?: Database["public"]['Enums']["client_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_assigned_team_member_fkey"
      columns: ["assigned_team_member"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "client_id": string | null,"created_at": string,"email": string,"full_name": string,"id": string,"notification_prefs": NonNullable<Json>,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "client_id"?: string | null,"created_at"?: string,"email": string,"full_name"?: string,"id": string,"notification_prefs"?: NonNullable<Json>,"role": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "client_id"?: string | null,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"notification_prefs"?: NonNullable<Json>,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                },"voice_corrections": {
                  Row: {
                    "body": string,"client_id": string,"created_at": string,"created_by": string | null,"id": string,"resolved_at": string | null,"resolved_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null
                  }
                  Update: {
                    "body"?: string,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "voice_corrections_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "voice_corrections_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "voice_corrections_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"voice_profiles": {
                  Row: {
                    "audience": string,"client_id": string,"created_at": string,"example_posts": NonNullable<Json>,"intake_answers": NonNullable<Json>,"interview_source": string,"interview_transcript": string,"offer": string,"phrases_never": (string)[],"phrases_use": (string)[],"summary": string,"summary_sent_at": string | null,"tone_notes": string,"topics_avoid": (string)[],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audience"?: string,"client_id": string,"created_at"?: string,"example_posts"?: NonNullable<Json>,"intake_answers"?: NonNullable<Json>,"interview_source"?: string,"interview_transcript"?: string,"offer"?: string,"phrases_never"?: (string)[],"phrases_use"?: (string)[],"summary"?: string,"summary_sent_at"?: string | null,"tone_notes"?: string,"topics_avoid"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "audience"?: string,"client_id"?: string,"created_at"?: string,"example_posts"?: NonNullable<Json>,"intake_answers"?: NonNullable<Json>,"interview_source"?: string,"interview_transcript"?: string,"offer"?: string,"phrases_never"?: (string)[],"phrases_use"?: (string)[],"summary"?: string,"summary_sent_at"?: string | null,"tone_notes"?: string,"topics_avoid"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "voice_profiles_client_id_fkey"
      columns: ["client_id"]
isOneToOne: true
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "log_event":
{ Args: { "p_action": string,"p_client_id": string,"p_details"?: Json,"p_record_id": string,"p_table": string }; Returns: undefined
                           },
"my_voice_summary":
{ Args: Record<PropertyKey, never>; Returns: {
              "audience": string,"offer": string,"phrases_never": (string)[],"phrases_use": (string)[],"summary": string,"topics_avoid": (string)[],"updated_at": string
            }[]
                           }
          }
          Enums: {
            "app_role": "admin"|"team"|"editor"|"client","client_status": "onboarding"|"active"|"paused"|"offboarded"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "team", "editor", "client"],"client_status": ["onboarding", "active", "paused", "offboarded"]
          }
        }
} as const
