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
      integration_connections: {
        Row: {
          access_token: string | null
          connected_by: string | null
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token: string | null
          tenant_id: string | null
          tenant_name: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider: Database["public"]["Enums"]["integration_provider"]
          refresh_token?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          refresh_token?: string | null
          tenant_id?: string | null
          tenant_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          created_at: string
          default_cost: number
          description: string | null
          id: string
          is_active: boolean
          is_tracked: boolean
          name: string
          precoro_item_id: string | null
          reorder_point: number | null
          sku: string
          uom: string
          updated_at: string
          xero_cogs_account: string | null
          xero_inventory_account: string | null
          xero_item_id: string | null
        }
        Insert: {
          created_at?: string
          default_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_tracked?: boolean
          name: string
          precoro_item_id?: string | null
          reorder_point?: number | null
          sku: string
          uom?: string
          updated_at?: string
          xero_cogs_account?: string | null
          xero_inventory_account?: string | null
          xero_item_id?: string | null
        }
        Update: {
          created_at?: string
          default_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_tracked?: boolean
          name?: string
          precoro_item_id?: string | null
          reorder_point?: number | null
          sku?: string
          uom?: string
          updated_at?: string
          xero_cogs_account?: string | null
          xero_inventory_account?: string | null
          xero_item_id?: string | null
        }
        Relationships: []
      }
      journal_batches: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          lines: Json
          narration: string | null
          period_end: string
          period_start: string
          posted_at: string | null
          status: Database["public"]["Enums"]["journal_status"]
          total_credit: number | null
          total_debit: number | null
          xero_journal_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          lines?: Json
          narration?: string | null
          period_end: string
          period_start: string
          posted_at?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number | null
          total_debit?: number | null
          xero_journal_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          lines?: Json
          narration?: string | null
          period_end?: string
          period_start?: string
          posted_at?: string | null
          status?: Database["public"]["Enums"]["journal_status"]
          total_credit?: number | null
          total_debit?: number | null
          xero_journal_id?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      po_lines: {
        Row: {
          description: string | null
          id: string
          item_id: string | null
          line_number: number | null
          po_id: string
          precoro_item_id: string | null
          qty_ordered: number
          qty_received: number
          unit_cost: number
        }
        Insert: {
          description?: string | null
          id?: string
          item_id?: string | null
          line_number?: number | null
          po_id: string
          precoro_item_id?: string | null
          qty_ordered?: number
          qty_received?: number
          unit_cost?: number
        }
        Update: {
          description?: string | null
          id?: string
          item_id?: string | null
          line_number?: number | null
          po_id?: string
          precoro_item_id?: string | null
          qty_ordered?: number
          qty_received?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "po_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          currency: string | null
          expected_at: string | null
          id: string
          ordered_at: string | null
          po_number: string
          precoro_id: string | null
          raw_payload: Json | null
          status: Database["public"]["Enums"]["po_status"]
          synced_at: string
          total_amount: number | null
          vendor_name: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          expected_at?: string | null
          id?: string
          ordered_at?: string | null
          po_number: string
          precoro_id?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["po_status"]
          synced_at?: string
          total_amount?: number | null
          vendor_name?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          expected_at?: string | null
          id?: string
          ordered_at?: string | null
          po_number?: string
          precoro_id?: string | null
          raw_payload?: Json | null
          status?: Database["public"]["Enums"]["po_status"]
          synced_at?: string
          total_amount?: number | null
          vendor_name?: string | null
        }
        Relationships: []
      }
      stock_levels: {
        Row: {
          avg_cost: number
          item_id: string
          location_id: string
          qty_on_hand: number
          updated_at: string
        }
        Insert: {
          avg_cost?: number
          item_id: string
          location_id: string
          qty_on_hand?: number
          updated_at?: string
        }
        Update: {
          avg_cost?: number
          item_id?: string
          location_id?: string
          qty_on_hand?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_location_id: string | null
          id: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          po_id: string | null
          qty: number
          reason: string | null
          reference: string | null
          to_location_id: string | null
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          item_id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          po_id?: string | null
          qty: number
          reason?: string | null
          reference?: string | null
          to_location_id?: string | null
          unit_cost?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          item_id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          po_id?: string | null
          qty?: number
          reason?: string | null
          reference?: string | null
          to_location_id?: string | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "accountant" | "warehouse" | "viewer"
      integration_provider: "xero" | "precoro"
      journal_status: "draft" | "posted" | "error"
      movement_type: "receipt" | "issue" | "transfer" | "adjustment"
      po_status: "open" | "partial" | "received" | "closed" | "cancelled"
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
      app_role: ["admin", "accountant", "warehouse", "viewer"],
      integration_provider: ["xero", "precoro"],
      journal_status: ["draft", "posted", "error"],
      movement_type: ["receipt", "issue", "transfer", "adjustment"],
      po_status: ["open", "partial", "received", "closed", "cancelled"],
    },
  },
} as const
