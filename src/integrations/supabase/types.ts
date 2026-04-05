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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_region_assignments: {
        Row: {
          id: string
          admin_id: string
          region_id: string
          created_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          region_id: string
          created_at?: string
        }
        Update: {
          id?: string
          admin_id?: string
          region_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_region_assignments_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_region_assignments_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          captain_id: string | null
          created_at: string
          dsr_id: string | null
          email: string
          id: string
          name: string | null
          role: string
          team_leader_id: string | null
          user_id: string | null
        }
        Insert: {
          captain_id?: string | null
          created_at?: string
          dsr_id?: string | null
          email: string
          id?: string
          name?: string | null
          role?: string
          team_leader_id?: string | null
          user_id?: string | null
        }
        Update: {
          captain_id?: string | null
          created_at?: string
          dsr_id?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string
          team_leader_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_dsr_id_fkey"
            columns: ["dsr_id"]
            isOneToOne: false
            referencedRelation: "dsrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          audit_target_type: string
          audit_date: string
          audited_by_admin_user_id: string | null
          audited_by_role: string
          captain_count: number
          captain_id: string | null
          created_at: string
          dsr_count: number
          dsr_id: string | null
          id: string
          issues: string | null
          no_package_smartcards: string[]
          notes: string | null
          unpaid_smartcards: string[]
          sales_count: number
          sold_smartcards: string[]
          stock_in_hand_smartcards: string[]
          status: string
          team_leader_id: string | null
          total_stock: number
        }
        Insert: {
          audit_target_type: string
          audit_date?: string
          audited_by_admin_user_id?: string | null
          audited_by_role: string
          captain_count?: number
          captain_id?: string | null
          created_at?: string
          dsr_count?: number
          dsr_id?: string | null
          id?: string
          issues?: string | null
          no_package_smartcards?: string[]
          notes?: string | null
          unpaid_smartcards?: string[]
          sales_count?: number
          sold_smartcards?: string[]
          stock_in_hand_smartcards?: string[]
          status?: string
          team_leader_id?: string | null
          total_stock?: number
        }
        Update: {
          audit_target_type?: string
          audit_date?: string
          audited_by_admin_user_id?: string | null
          audited_by_role?: string
          captain_count?: number
          captain_id?: string | null
          created_at?: string
          dsr_count?: number
          dsr_id?: string | null
          id?: string
          issues?: string | null
          no_package_smartcards?: string[]
          notes?: string | null
          unpaid_smartcards?: string[]
          sales_count?: number
          sold_smartcards?: string[]
          stock_in_hand_smartcards?: string[]
          status?: string
          team_leader_id?: string | null
          total_stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "audits_audited_by_admin_user_id_fkey"
            columns: ["audited_by_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_dsr_id_fkey"
            columns: ["dsr_id"]
            isOneToOne: false
            referencedRelation: "dsrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      captains: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          team_leader_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          team_leader_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          team_leader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captains_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
        ]
      }
      dsrs: {
        Row: {
          captain_id: string | null
          created_at: string
          district: string | null
          dsr_number: string | null
          fss_username: string | null
          has_fss_account: boolean
          id: string
          name: string
          phone: string | null
          street_village: string | null
          ward: string | null
        }
        Insert: {
          captain_id?: string | null
          created_at?: string
          district?: string | null
          dsr_number?: string | null
          fss_username?: string | null
          has_fss_account?: boolean
          id?: string
          name: string
          phone?: string | null
          street_village?: string | null
          ward?: string | null
        }
        Update: {
          captain_id?: string | null
          created_at?: string
          district?: string | null
          dsr_number?: string | null
          fss_username?: string | null
          has_fss_account?: boolean
          id?: string
          name?: string
          phone?: string | null
          street_village?: string | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dsrs_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          assigned_to_id: string | null
          assigned_to_type: string | null
          created_at: string
          id: string
          notes: string | null
          package_status: string
          payment_status: string
          region_id: string | null
          serial_number: string
          smartcard_number: string
          status: string
          stock_type: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          assigned_to_id?: string | null
          assigned_to_type?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          package_status?: string
          payment_status?: string
          region_id?: string | null
          serial_number: string
          smartcard_number: string
          status?: string
          stock_type?: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          assigned_to_id?: string | null
          assigned_to_type?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          package_status?: string
          payment_status?: string
          region_id?: string | null
          serial_number?: string
          smartcard_number?: string
          status?: string
          stock_type?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_sales: {
        Row: {
          id: string
          inventory_id: string | null
          smartcard_number: string
          serial_number: string
          stock_type: string
          customer_name: string | null
          sale_date: string
          payment_status: string
          package_status: string
          team_leader_id: string | null
          captain_id: string | null
          dsr_id: string | null
          zone_id: string | null
          region_id: string | null
          notes: string | null
          approval_status: string
          submitted_by_admin_user_id: string | null
          submitted_by_role: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          inventory_id?: string | null
          smartcard_number: string
          serial_number: string
          stock_type?: string
          customer_name?: string | null
          sale_date?: string
          payment_status?: string
          package_status?: string
          team_leader_id?: string | null
          captain_id?: string | null
          dsr_id?: string | null
          zone_id?: string | null
          region_id?: string | null
          notes?: string | null
          approval_status?: string
          submitted_by_admin_user_id?: string | null
          submitted_by_role?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          inventory_id?: string | null
          smartcard_number?: string
          serial_number?: string
          stock_type?: string
          customer_name?: string | null
          sale_date?: string
          payment_status?: string
          package_status?: string
          team_leader_id?: string | null
          captain_id?: string | null
          dsr_id?: string | null
          zone_id?: string | null
          region_id?: string | null
          notes?: string | null
          approval_status?: string
          submitted_by_admin_user_id?: string | null
          submitted_by_role?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_sales_submitted_by_admin_user_id_fkey"
            columns: ["submitted_by_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_dsr_id_fkey"
            columns: ["dsr_id"]
            isOneToOne: false
            referencedRelation: "dsrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_sales_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          created_at: string
          id: string
          name: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_records: {
        Row: {
          amount: number | null
          captain_id: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          dsr_id: string | null
          id: string
          inventory_id: string | null
          notes: string | null
          package_status: string
          payment_status: string
          region_id: string | null
          sale_date: string
          serial_number: string
          smartcard_number: string
          stock_type: string
          stripe_payment_id: string | null
          team_leader_id: string | null
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          amount?: number | null
          captain_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          dsr_id?: string | null
          id?: string
          inventory_id?: string | null
          notes?: string | null
          package_status?: string
          payment_status?: string
          region_id?: string | null
          sale_date?: string
          serial_number: string
          smartcard_number: string
          stock_type?: string
          stripe_payment_id?: string | null
          team_leader_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          amount?: number | null
          captain_id?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          dsr_id?: string | null
          id?: string
          inventory_id?: string | null
          notes?: string | null
          package_status?: string
          payment_status?: string
          region_id?: string | null
          sale_date?: string
          serial_number?: string
          smartcard_number?: string
          stock_type?: string
          stripe_payment_id?: string | null
          team_leader_id?: string | null
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_records_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_dsr_id_fkey"
            columns: ["dsr_id"]
            isOneToOne: false
            referencedRelation: "dsrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_records_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      team_leaders: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          region_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          region_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_leaders_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      sales_targets: {
        Row: {
          id: string
          team_leader_id: string
          year: number
          month: number
          target_amount: number
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          team_leader_id: string
          year: number
          month: number
          target_amount: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          team_leader_id?: string
          year?: number
          month?: number
          target_amount?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToMany: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToMany: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      captain_targets: {
        Row: {
          id: string
          captain_id: string
          team_leader_id: string
          year: number
          month: number
          target_amount: number
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          captain_id: string
          team_leader_id: string
          year: number
          month: number
          target_amount: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          captain_id?: string
          team_leader_id?: string
          year?: number
          month?: number
          target_amount?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captain_targets_captain_id_fkey"
            columns: ["captain_id"]
            isOneToMany: false
            referencedRelation: "captains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_targets_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToMany: false
            referencedRelation: "team_leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToMany: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tsm_targets: {
        Row: {
          id: string
          region_id: string
          year: number
          month: number
          target_amount: number
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          region_id: string
          year: number
          month: number
          target_amount: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          region_id?: string
          year?: number
          month?: number
          target_amount?: number
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tsm_targets_region_id_fkey"
            columns: ["region_id"]
            isOneToMany: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tsm_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToMany: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_admin_region_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      has_region_access: { Args: { target_region_id: string }; Returns: boolean }
      is_admin_user: { Args: { checking_user_id: string }; Returns: boolean }
      is_super_admin: { Args: { checking_user_id: string }; Returns: boolean }
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
