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
      academic_terms: {
        Row: {
          code: string
          ends_on: string
          is_current: boolean
          name: string
          starts_on: string
        }
        Insert: {
          code: string
          ends_on: string
          is_current?: boolean
          name: string
          starts_on: string
        }
        Update: {
          code?: string
          ends_on?: string
          is_current?: boolean
          name?: string
          starts_on?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_terms: {
        Row: {
          course_id: string
          created_at: string
          id: string
          instructor_id: string | null
          term_code: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          instructor_id?: string | null
          term_code: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          instructor_id?: string | null
          term_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_terms_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_terms_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_terms_term_code_fkey"
            columns: ["term_code"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["code"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          created_at: string
          department: string
          id: string
          organization_unit_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          department: string
          id?: string
          organization_unit_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          department?: string
          id?: string
          organization_unit_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bucket_id: string
          created_at: string
          created_by: string
          file_name: string
          id: string
          mime_type: string
          object_path: string
          size_bytes: number
          stage_id: string | null
          tracker_id: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          created_by?: string
          file_name: string
          id?: string
          mime_type: string
          object_path: string
          size_bytes: number
          stage_id?: string | null
          tracker_id: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          created_by?: string
          file_name?: string
          id?: string
          mime_type?: string
          object_path?: string
          size_bytes?: number
          stage_id?: string | null
          tracker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_stage_id_tracker_id_fkey"
            columns: ["stage_id", "tracker_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "tracker_id"]
          },
          {
            foreignKeyName: "documents_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_benchmark_settings: {
        Row: {
          average_threshold: number
          id: string
          pass_rate_threshold: number
          scope: string
          tracker_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          average_threshold?: number
          id?: string
          pass_rate_threshold?: number
          scope?: string
          tracker_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          average_threshold?: number
          id?: string
          pass_rate_threshold?: number
          scope?: string
          tracker_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_benchmark_settings_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_benchmark_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_entries: {
        Row: {
          final_grade: number
          grade_upload_id: string
          id: number
          source_row: number
        }
        Insert: {
          final_grade: number
          grade_upload_id: string
          id?: never
          source_row: number
        }
        Update: {
          final_grade?: number
          grade_upload_id?: string
          id?: never
          source_row?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_entries_grade_upload_id_fkey"
            columns: ["grade_upload_id"]
            isOneToOne: false
            referencedRelation: "grade_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_submission_targets: {
        Row: {
          course_term_id: string
          created_at: string
          created_by: string
          id: string
          tracker_id: string
        }
        Insert: {
          course_term_id: string
          created_at?: string
          created_by?: string
          id?: string
          tracker_id: string
        }
        Update: {
          course_term_id?: string
          created_at?: string
          created_by?: string
          id?: string
          tracker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grade_submission_targets_course_term_id_fkey"
            columns: ["course_term_id"]
            isOneToOne: false
            referencedRelation: "course_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_submission_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_submission_targets_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_uploads: {
        Row: {
          class_average: number
          course_term_id: string
          created_at: string
          distribution_json: Json
          enrolled_count: number
          id: string
          is_active: boolean
          pass_rate: number
          submission_source: string
          uploaded_by: string
          version: number
        }
        Insert: {
          class_average?: number
          course_term_id: string
          created_at?: string
          distribution_json?: Json
          enrolled_count?: number
          id?: string
          is_active?: boolean
          pass_rate?: number
          submission_source?: string
          uploaded_by?: string
          version: number
        }
        Update: {
          class_average?: number
          course_term_id?: string
          created_at?: string
          distribution_json?: Json
          enrolled_count?: number
          id?: string
          is_active?: boolean
          pass_rate?: number
          submission_source?: string
          uploaded_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_uploads_course_term_id_fkey"
            columns: ["course_term_id"]
            isOneToOne: false
            referencedRelation: "course_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grade_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      important_dates: {
        Row: {
          academic_year: string
          created_at: string
          description: string
          ends_on: string
          id: string
          imported_by: string
          semester: string
          short_name: string
          sort_order: number
          source_file_name: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          description: string
          ends_on: string
          id?: string
          imported_by?: string
          semester: string
          short_name: string
          sort_order: number
          source_file_name: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          description?: string
          ends_on?: string
          id?: string
          imported_by?: string
          semester?: string
          short_name?: string
          sort_order?: number
          source_file_name?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "important_dates_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_units: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profile_scopes: {
        Row: {
          created_at: string
          organization_unit_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          organization_unit_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          organization_unit_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_scopes_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_scopes_profile_id_fkey"
            columns: ["profile_id"]
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
          full_name: string
          id: string
          is_active: boolean
          organization_unit_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          is_active?: boolean
          organization_unit_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          organization_unit_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
      public_grade_submissions: {
        Row: {
          course_term_id: string
          created_at: string
          faculty_email: string
          faculty_name: string
          grade_upload_id: string
          id: string
        }
        Insert: {
          course_term_id: string
          created_at?: string
          faculty_email: string
          faculty_name: string
          grade_upload_id: string
          id?: string
        }
        Update: {
          course_term_id?: string
          created_at?: string
          faculty_email?: string
          faculty_name?: string
          grade_upload_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_grade_submissions_course_term_id_fkey"
            columns: ["course_term_id"]
            isOneToOne: false
            referencedRelation: "course_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_grade_submissions_grade_upload_id_fkey"
            columns: ["grade_upload_id"]
            isOneToOne: true
            referencedRelation: "grade_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          stage_id: string
          title: string
          tracker_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          stage_id: string
          title: string
          tracker_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          stage_id?: string
          title?: string
          tracker_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_links_stage_id_tracker_id_fkey"
            columns: ["stage_id", "tracker_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id", "tracker_id"]
          },
          {
            foreignKeyName: "stage_links_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          created_at: string
          created_by: string
          description: string
          due_date: string
          id: string
          is_required: boolean
          sort_order: number
          status: Database["public"]["Enums"]["stage_status"]
          title: string
          tracker_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string
          due_date: string
          id?: string
          is_required?: boolean
          sort_order: number
          status?: Database["public"]["Enums"]["stage_status"]
          title: string
          tracker_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          id?: string
          is_required?: boolean
          sort_order?: number
          status?: Database["public"]["Enums"]["stage_status"]
          title?: string
          tracker_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stages_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_status_overrides: {
        Row: {
          cleared_at: string | null
          cleared_by: string | null
          course_id: string
          created_at: string
          created_by: string
          id: string
          reason: string
          status: Database["public"]["Enums"]["submission_status"]
          term_code: string
        }
        Insert: {
          cleared_at?: string | null
          cleared_by?: string | null
          course_id: string
          created_at?: string
          created_by?: string
          id?: string
          reason: string
          status: Database["public"]["Enums"]["submission_status"]
          term_code: string
        }
        Update: {
          cleared_at?: string | null
          cleared_by?: string | null
          course_id?: string
          created_at?: string
          created_by?: string
          id?: string
          reason?: string
          status?: Database["public"]["Enums"]["submission_status"]
          term_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_status_overrides_cleared_by_fkey"
            columns: ["cleared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_status_overrides_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_status_overrides_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_status_overrides_term_code_fkey"
            columns: ["term_code"]
            isOneToOne: false
            referencedRelation: "academic_terms"
            referencedColumns: ["code"]
          },
        ]
      }
      tracker_members: {
        Row: {
          access: Database["public"]["Enums"]["member_access"]
          created_at: string
          profile_id: string
          tracker_id: string
        }
        Insert: {
          access?: Database["public"]["Enums"]["member_access"]
          created_at?: string
          profile_id: string
          tracker_id: string
        }
        Update: {
          access?: Database["public"]["Enums"]["member_access"]
          created_at?: string
          profile_id?: string
          tracker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_members_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_template_stages: {
        Row: {
          description: string
          due_offset_days: number
          id: string
          is_required: boolean
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          description?: string
          due_offset_days: number
          id?: string
          is_required?: boolean
          sort_order: number
          template_id: string
          title: string
        }
        Update: {
          description?: string
          due_offset_days?: number
          id?: string
          is_required?: boolean
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_template_stages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tracker_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_templates: {
        Row: {
          category: Database["public"]["Enums"]["tracker_category"]
          created_at: string
          description: string
          id: string
          name: string
          owner_id: string
          scope: string
          type: Database["public"]["Enums"]["tracker_type"]
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["tracker_category"]
          created_at?: string
          description?: string
          id?: string
          name: string
          owner_id?: string
          scope?: string
          type: Database["public"]["Enums"]["tracker_type"]
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["tracker_category"]
          created_at?: string
          description?: string
          id?: string
          name?: string
          owner_id?: string
          scope?: string
          type?: Database["public"]["Enums"]["tracker_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_templates_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trackers: {
        Row: {
          average_threshold: number | null
          category: Database["public"]["Enums"]["tracker_category"]
          created_at: string
          created_by: string
          description: string
          id: string
          organization_unit_id: string | null
          pass_rate_threshold: number | null
          title: string
          type: Database["public"]["Enums"]["tracker_type"]
          updated_at: string
        }
        Insert: {
          average_threshold?: number | null
          category: Database["public"]["Enums"]["tracker_category"]
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          organization_unit_id?: string | null
          pass_rate_threshold?: number | null
          title: string
          type: Database["public"]["Enums"]["tracker_type"]
          updated_at?: string
        }
        Update: {
          average_threshold?: number | null
          category?: Database["public"]["Enums"]["tracker_category"]
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          organization_unit_id?: string | null
          pass_rate_threshold?: number | null
          title?: string
          type?: Database["public"]["Enums"]["tracker_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trackers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trackers_organization_unit_id_fkey"
            columns: ["organization_unit_id"]
            isOneToOne: false
            referencedRelation: "organization_units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_academic_term: {
        Args: {
          p_code: string
          p_ends_on: string
          p_is_current?: boolean
          p_name: string
          p_starts_on: string
        }
        Returns: string
      }
      create_tracker_from_template: {
        Args: {
          p_anchor_date: string
          p_description: string
          p_template_id: string
          p_title: string
        }
        Returns: string
      }
      delete_course_term_grades: {
        Args: { p_course_id: string; p_term_code: string }
        Returns: number
      }
      import_grade_targets: {
        Args: { p_rows: Json; p_term_code: string; p_tracker_id: string }
        Returns: number
      }
      import_important_dates: {
        Args: {
          p_academic_year: string
          p_rows: Json
          p_source_file_name: string
        }
        Returns: number
      }
      resolve_grade_course: {
        Args: {
          p_course_code: string
          p_course_title: string
          p_term_code: string
        }
        Returns: Json
      }
      save_tracker_template: {
        Args: {
          p_category: Database["public"]["Enums"]["tracker_category"]
          p_description: string
          p_name: string
          p_scope: string
          p_stages: Json
          p_template_id: string
          p_type: Database["public"]["Enums"]["tracker_type"]
        }
        Returns: string
      }
      submit_grade_upload: {
        Args: { p_course_term_id: string; p_grades: number[] }
        Returns: Json
      }
      submit_public_grade_upload: {
        Args: {
          p_course_code: string
          p_course_title: string
          p_term_code: string
          p_faculty_email: string
          p_faculty_name: string
          p_file_course_code: string
          p_grades: number[]
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "dean"
        | "academic_director"
        | "chair"
        | "program_lead"
        | "instructor"
        | "research_lead"
        | "graduate_supervisor"
      member_access: "viewer" | "editor" | "manager"
      stage_status: "pending" | "in_progress" | "completed" | "skipped"
      submission_status: "submitted" | "outstanding"
      tracker_category: "Administrative" | "Academic" | "Research" | "Other"
      tracker_type: "general" | "grade_submission"
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
    Enums: {
      app_role: [
        "dean",
        "academic_director",
        "chair",
        "program_lead",
        "instructor",
        "research_lead",
        "graduate_supervisor",
      ],
      member_access: ["viewer", "editor", "manager"],
      stage_status: ["pending", "in_progress", "completed", "skipped"],
      submission_status: ["submitted", "outstanding"],
      tracker_category: ["Administrative", "Academic", "Research", "Other"],
      tracker_type: ["general", "grade_submission"],
    },
  },
} as const
