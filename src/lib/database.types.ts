export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          id: string
          intern_id: string
          module_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          intern_id: string
          module_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          intern_id?: string
          module_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      intern_managers: {
        Row: {
          created_at: string
          created_by: string | null
          intern_id: string
          manager_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          intern_id: string
          manager_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          intern_id?: string
          manager_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intern_managers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_managers_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intern_managers_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      module_links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          module_id: string
          sort_order: number
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          module_id: string
          sort_order?: number
          title: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          module_id?: string
          sort_order?: number
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_links_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_minutes: number | null
          id: string
          is_published: boolean
          platform: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          platform?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          is_published?: boolean
          platform?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          day: string
          end_time: string | null
          expected_hours: number
          id: string
          intern_id: string
          start_time: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at: string
          updated_by: string | null
          week_start: string
        }
        Insert: {
          created_at?: string
          day: string
          end_time?: string | null
          expected_hours?: never
          id?: string
          intern_id: string
          start_time?: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          updated_by?: string | null
          week_start?: never
        }
        Update: {
          created_at?: string
          day?: string
          end_time?: string | null
          expected_hours?: never
          id?: string
          intern_id?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          updated_at?: string
          updated_by?: string | null
          week_start?: never
        }
        Relationships: [
          {
            foreignKeyName: "schedules_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_logs: {
        Row: {
          actual_hours: number | null
          clock_in: string
          clock_out: string | null
          created_at: string
          id: string
          intern_id: string
          updated_at: string
          updated_by: string | null
          work_date: string
        }
        Insert: {
          actual_hours?: never
          clock_in: string
          clock_out?: string | null
          created_at?: string
          id?: string
          intern_id: string
          updated_at?: string
          updated_by?: string | null
          work_date?: never
        }
        Update: {
          actual_hours?: never
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          id?: string
          intern_id?: string
          updated_at?: string
          updated_by?: string | null
          work_date?: never
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_intern_id_fkey"
            columns: ["intern_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_logs_updated_by_fkey"
            columns: ["updated_by"]
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
      clock_in: { Args: never; Returns: string }
      clock_out: { Args: never; Returns: string }
      create_intern: {
        Args: { p_email: string; p_full_name: string; p_manager_ids?: string[] }
        Returns: Json
      }
      create_manager: {
        Args: { p_email: string; p_full_name: string }
        Returns: Json
      }
      delete_intern: { Args: { p_user_id: string }; Returns: undefined }
      delete_manager: { Args: { p_user_id: string }; Returns: undefined }
      google_access_facts: { Args: never; Returns: Json }
    }
    Enums: {
      assignment_status: "not_started" | "in_progress" | "completed"
      schedule_status: "available" | "unavailable" | "remote" | "out"
      user_role: "admin" | "intern" | "master"
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
