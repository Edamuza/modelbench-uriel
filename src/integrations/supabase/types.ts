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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      prices: {
        Row: {
          friendly_name: string
          input_per_m: number
          model_id: string
          output_per_m: number
          size_tag: string
          sort: number
        }
        Insert: {
          friendly_name: string
          input_per_m?: number
          model_id: string
          output_per_m?: number
          size_tag?: string
          sort?: number
        }
        Update: {
          friendly_name?: string
          input_per_m?: number
          model_id?: string
          output_per_m?: number
          size_tag?: string
          sort?: number
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          change_note: string
          created_at: string
          id: string
          system_prompt: string
          task_id: string
          user_template: string
          version: number
        }
        Insert: {
          change_note?: string
          created_at?: string
          id?: string
          system_prompt?: string
          task_id: string
          user_template?: string
          version: number
        }
        Update: {
          change_note?: string
          created_at?: string
          id?: string
          system_prompt?: string
          task_id?: string
          user_template?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      run_calls: {
        Row: {
          created_at: string
          error: string | null
          grade_status: string
          id: string
          input_position: number
          input_text: string
          input_tokens: number | null
          latency_ms: number | null
          model_id: string
          output: string | null
          output_tokens: number | null
          reason: string | null
          reference: string | null
          run_id: string
          score: number | null
          status: string
          test_input_id: string | null
          tokens_estimated: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          grade_status?: string
          id?: string
          input_position?: number
          input_text: string
          input_tokens?: number | null
          latency_ms?: number | null
          model_id: string
          output?: string | null
          output_tokens?: number | null
          reason?: string | null
          reference?: string | null
          run_id: string
          score?: number | null
          status?: string
          test_input_id?: string | null
          tokens_estimated?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          grade_status?: string
          id?: string
          input_position?: number
          input_text?: string
          input_tokens?: number | null
          latency_ms?: number | null
          model_id?: string
          output?: string | null
          output_tokens?: number | null
          reason?: string | null
          reference?: string | null
          run_id?: string
          score?: number | null
          status?: string
          test_input_id?: string | null
          tokens_estimated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "run_calls_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_calls_test_input_id_fkey"
            columns: ["test_input_id"]
            isOneToOne: false
            referencedRelation: "test_inputs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_seed: boolean
          models: string[]
          prompt_version: number
          prompt_version_id: string | null
          status: string
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_seed?: boolean
          models: string[]
          prompt_version?: number
          prompt_version_id?: string | null
          status?: string
          task_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_seed?: boolean
          models?: string[]
          prompt_version?: number
          prompt_version_id?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_prompt_version_id_fkey"
            columns: ["prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: number
          pass_rate_target: number
          php_rate: number
        }
        Insert: {
          id?: number
          pass_rate_target?: number
          php_rate?: number
        }
        Update: {
          id?: number
          pass_rate_target?: number
          php_rate?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          pass_threshold: number
          rubric: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          pass_threshold?: number
          rubric?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          pass_threshold?: number
          rubric?: string
        }
        Relationships: []
      }
      test_inputs: {
        Row: {
          created_at: string
          id: string
          input: string
          position: number
          reference: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input: string
          position?: number
          reference?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: string
          position?: number
          reference?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_inputs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_demo: { Args: never; Returns: undefined }
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
    Enums: {},
  },
} as const
