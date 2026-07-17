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
      bodyweight_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at: string
          date: string
          id: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "bodyweight_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_workouts: {
        Row: {
          created_at: string
          day: Json
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at: string
          day?: Json
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: Json
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_workouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      default_template: {
        Row: {
          day: Json | null
          entries: Json
          id: string
        }
        Insert: {
          day?: Json | null
          entries?: Json
          id?: string
        }
        Update: {
          day?: Json | null
          entries?: Json
          id?: string
        }
        Relationships: []
      }
      exercise_notes: {
        Row: {
          exercise_id: string
          note: string
          technique_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          exercise_id: string
          note?: string
          technique_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          exercise_id?: string
          note?: string
          technique_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_notes_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          attribute: string
          category: string
          id: string
          image_url: string | null
          measurement: string
          progressions: Json
          rep_style: string
          title: string
        }
        Insert: {
          attribute: string
          category: string
          id: string
          image_url?: string | null
          measurement?: string
          progressions?: Json
          rep_style?: string
          title: string
        }
        Update: {
          attribute?: string
          category?: string
          id?: string
          image_url?: string | null
          measurement?: string
          progressions?: Json
          rep_style?: string
          title?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          id: string
          message: string
          type: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          message: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
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
          created_at: string
          email: string | null
          height_cm: number | null
          id: string
          is_admin: boolean
          name: string
          target_weight_kg: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          height_cm?: number | null
          id: string
          is_admin?: boolean
          name?: string
          target_weight_kg?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          height_cm?: number | null
          id?: string
          is_admin?: boolean
          name?: string
          target_weight_kg?: number | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          goals: Json | null
          id: string
          mesocycle: Json
          name: string
          periodization: string
          split_type: string | null
          sport: Json | null
          status: string
          training_days: Json
          type: string
          updated_at: string
          user_id: string
          weeks: number
        }
        Insert: {
          created_at: string
          goals?: Json | null
          id: string
          mesocycle?: Json
          name: string
          periodization: string
          split_type?: string | null
          sport?: Json | null
          status: string
          training_days?: Json
          type: string
          updated_at: string
          user_id: string
          weeks: number
        }
        Update: {
          created_at?: string
          goals?: Json | null
          id?: string
          mesocycle?: Json
          name?: string
          periodization?: string
          split_type?: string | null
          sport?: Json | null
          status?: string
          training_days?: Json
          type?: string
          updated_at?: string
          user_id?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "programs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          created_at: string
          id: string
          program_id: string
          start_date: string
          status: string
          user_id: string
        }
        Insert: {
          created_at: string
          id: string
          program_id: string
          start_date: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_id?: string
          start_date?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          custom_workout_id: string | null
          date: string
          duration_seconds: number | null
          entries: Json
          has_entries: boolean | null
          id: string
          run_id: string | null
          status: string
          user_id: string
          week_index: number
          weekday: string
        }
        Insert: {
          custom_workout_id?: string | null
          date: string
          duration_seconds?: number | null
          entries?: Json
          has_entries?: boolean | null
          id: string
          run_id?: string | null
          status: string
          user_id: string
          week_index: number
          weekday: string
        }
        Update: {
          custom_workout_id?: string | null
          date?: string
          duration_seconds?: number | null
          entries?: Json
          has_entries?: boolean | null
          id?: string
          run_id?: string | null
          status?: string
          user_id?: string
          week_index?: number
          weekday?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_custom_workout_id_fkey"
            columns: ["custom_workout_id"]
            isOneToOne: false
            referencedRelation: "custom_workouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      techniques: {
        Row: {
          description: string
          id: string
          name: string
        }
        Insert: {
          description?: string
          id: string
          name: string
        }
        Update: {
          description?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      completed_sessions_for_exercises: {
        Args: { p_exercise_ids: string[]; p_user_id: string }
        Returns: {
          custom_workout_id: string | null
          date: string
          duration_seconds: number | null
          entries: Json
          has_entries: boolean | null
          id: string
          run_id: string | null
          status: string
          user_id: string
          week_index: number
          weekday: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

