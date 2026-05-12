export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string;
          inquiry_id: string;
          lead_id: string;
          scheduled_at: string;
          item_category: string | null;
          item_description: string | null;
          address: string | null;
          preferred_method: "visit" | "delivery" | null;
          staff_id: string | null;
          status: string;
          core_synced_at: string | null;
          core_appointment_id: string | null;
          reminder_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          lead_id: string;
          scheduled_at: string;
          item_category?: string | null;
          item_description?: string | null;
          address?: string | null;
          preferred_method?: "visit" | "delivery" | null;
          staff_id?: string | null;
          status?: string;
          core_synced_at?: string | null;
          core_appointment_id?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inquiry_id?: string;
          lead_id?: string;
          scheduled_at?: string;
          item_category?: string | null;
          item_description?: string | null;
          address?: string | null;
          preferred_method?: "visit" | "delivery" | null;
          staff_id?: string | null;
          status?: string;
          core_synced_at?: string | null;
          core_appointment_id?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          id: string;
          name: string;
          brand_code: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          brand_code?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          brand_code?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      core_sync_log: {
        Row: {
          id: string;
          direction: "to_core" | "from_core";
          entity_type: string | null;
          entity_id: string | null;
          payload: Json | null;
          status: "success" | "failed";
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          direction: "to_core" | "from_core";
          entity_type?: string | null;
          entity_id?: string | null;
          payload?: Json | null;
          status: "success" | "failed";
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          direction?: "to_core" | "from_core";
          entity_type?: string | null;
          entity_id?: string | null;
          payload?: Json | null;
          status?: "success" | "failed";
          error_message?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      comparison_site_accounts: {
        Row: {
          id: string;
          brand_id: string | null;
          store_id: string | null;
          site: "oikura" | "uridoki" | "hikakaku";
          account_email: string | null;
          notification_email: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          site: "oikura" | "uridoki" | "hikakaku";
          account_email?: string | null;
          notification_email?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          site?: "oikura" | "uridoki" | "hikakaku";
          account_email?: string | null;
          notification_email?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comparison_site_accounts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comparison_site_accounts_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      email_accounts: {
        Row: {
          id: string;
          brand_id: string | null;
          store_id: string | null;
          email: string;
          display_name: string | null;
          provider: "gmail" | "other";
          purpose: "inquiry" | "reply";
          oauth_tokens: Json | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          email: string;
          display_name?: string | null;
          provider?: "gmail" | "other";
          purpose?: "inquiry" | "reply";
          oauth_tokens?: Json | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          email?: string;
          display_name?: string | null;
          provider?: "gmail" | "other";
          purpose?: "inquiry" | "reply";
          oauth_tokens?: Json | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_accounts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_accounts_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiries: {
        Row: {
          id: string;
          lead_id: string | null;
          brand_id: string | null;
          store_id: string | null;
          line_account_id: string | null;
          email_account_id: string | null;
          comparison_account_id: string | null;
          channel: Database["public"]["Enums"]["inquiry_channel"];
          status: Database["public"]["Enums"]["inquiry_status"];
          subject: string | null;
          assigned_to: string | null;
          flow_data: Json | null;
          call_sid: string | null;
          source_site: string | null;
          priority: number | null;
          internal_note: string | null;
          first_response_at: string | null;
          ai_suggested_reply: string | null;
          msg_category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
          brand_id?: string | null;
          store_id?: string | null;
          line_account_id?: string | null;
          email_account_id?: string | null;
          comparison_account_id?: string | null;
          channel: Database["public"]["Enums"]["inquiry_channel"];
          status?: Database["public"]["Enums"]["inquiry_status"];
          subject?: string | null;
          assigned_to?: string | null;
          flow_data?: Json | null;
          call_sid?: string | null;
          source_site?: string | null;
          priority?: number | null;
          internal_note?: string | null;
          first_response_at?: string | null;
          ai_suggested_reply?: string | null;
          msg_category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
          brand_id?: string | null;
          store_id?: string | null;
          line_account_id?: string | null;
          email_account_id?: string | null;
          comparison_account_id?: string | null;
          channel?: Database["public"]["Enums"]["inquiry_channel"];
          status?: Database["public"]["Enums"]["inquiry_status"];
          subject?: string | null;
          assigned_to?: string | null;
          flow_data?: Json | null;
          call_sid?: string | null;
          source_site?: string | null;
          priority?: number | null;
          internal_note?: string | null;
          first_response_at?: string | null;
          ai_suggested_reply?: string | null;
          msg_category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiries_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_line_account_id_fkey";
            columns: ["line_account_id"];
            isOneToOne: false;
            referencedRelation: "line_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_email_account_id_fkey";
            columns: ["email_account_id"];
            isOneToOne: false;
            referencedRelation: "email_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiries_comparison_account_id_fkey";
            columns: ["comparison_account_id"];
            isOneToOne: false;
            referencedRelation: "comparison_site_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      inquiry_tags: {
        Row: {
          inquiry_id: string;
          tag: string;
        };
        Insert: {
          inquiry_id: string;
          tag: string;
        };
        Update: {
          inquiry_id?: string;
          tag?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_tags_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          id: string;
          line_user_id: string | null;
          phone: string | null;
          email: string | null;
          display_name: string | null;
          line_tags: string[] | null;
          first_channel: Database["public"]["Enums"]["inquiry_channel"] | null;
          core_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          line_user_id?: string | null;
          phone?: string | null;
          email?: string | null;
          display_name?: string | null;
          line_tags?: string[] | null;
          first_channel?: Database["public"]["Enums"]["inquiry_channel"] | null;
          core_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          line_user_id?: string | null;
          phone?: string | null;
          email?: string | null;
          display_name?: string | null;
          line_tags?: string[] | null;
          first_channel?: Database["public"]["Enums"]["inquiry_channel"] | null;
          core_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      line_accounts: {
        Row: {
          id: string;
          brand_id: string | null;
          store_id: string | null;
          name: string;
          channel_id: string;
          channel_secret: string;
          channel_access_token: string;
          destination: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          name: string;
          channel_id: string;
          channel_secret: string;
          channel_access_token: string;
          destination?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          name?: string;
          channel_id?: string;
          channel_secret?: string;
          channel_access_token?: string;
          destination?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "line_accounts_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "line_accounts_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          inquiry_id: string;
          direction: Database["public"]["Enums"]["message_direction"];
          body: string | null;
          media_urls: string[] | null;
          line_msg_id: string | null;
          email_msg_id: string | null;
          sent_by: string | null;
          is_auto: boolean;
          created_at: string;
          // AI返信ログ
          ai_suggested: boolean;
          ai_theme: string | null;
          ai_theme_changed: boolean | null;
          final_theme: string | null;
          ai_edited: boolean | null;
          ai_original_body: string | null;
          // AI学習システム（migration 012）
          ai_edit_reason: string | null;
          ai_auto_sent: boolean;
          prompt_version_id: string | null;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          direction: Database["public"]["Enums"]["message_direction"];
          body?: string | null;
          media_urls?: string[] | null;
          line_msg_id?: string | null;
          email_msg_id?: string | null;
          sent_by?: string | null;
          is_auto?: boolean;
          created_at?: string;
          // AI返信ログ
          ai_suggested?: boolean;
          ai_theme?: string | null;
          ai_theme_changed?: boolean | null;
          final_theme?: string | null;
          ai_edited?: boolean | null;
          ai_original_body?: string | null;
          // AI学習システム（migration 012）
          ai_edit_reason?: string | null;
          ai_auto_sent?: boolean;
          prompt_version_id?: string | null;
        };
        Update: {
          id?: string;
          inquiry_id?: string;
          direction?: Database["public"]["Enums"]["message_direction"];
          body?: string | null;
          media_urls?: string[] | null;
          line_msg_id?: string | null;
          email_msg_id?: string | null;
          sent_by?: string | null;
          is_auto?: boolean;
          created_at?: string;
          // AI返信ログ
          ai_suggested?: boolean;
          ai_theme?: string | null;
          ai_theme_changed?: boolean | null;
          final_theme?: string | null;
          ai_edited?: boolean | null;
          ai_original_body?: string | null;
          // AI学習システム（migration 012）
          ai_edit_reason?: string | null;
          ai_auto_sent?: boolean;
          prompt_version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      phone_numbers: {
        Row: {
          id: string;
          brand_id: string | null;
          store_id: string | null;
          phone_number: string;
          twilio_sid: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          phone_number: string;
          twilio_sid?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string | null;
          store_id?: string | null;
          phone_number?: string;
          twilio_sid?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "phone_numbers_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "phone_numbers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          id: string;
          auth_id: string | null;
          name: string;
          email: string;
          role: "super_admin" | "admin" | "operator" | "viewer";
          is_active: boolean;
          requires_quote_review: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          name: string;
          email: string;
          role?: "super_admin" | "admin" | "operator" | "viewer";
          is_active?: boolean;
          requires_quote_review?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          name?: string;
          email?: string;
          role?: "super_admin" | "admin" | "operator" | "viewer";
          is_active?: boolean;
          requires_quote_review?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      staff_brand_access: {
        Row: {
          staff_id: string;
          brand_id: string;
        };
        Insert: {
          staff_id: string;
          brand_id: string;
        };
        Update: {
          staff_id?: string;
          brand_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_brand_access_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_brand_access_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_store_access: {
        Row: {
          staff_id: string;
          store_id: string;
        };
        Insert: {
          staff_id: string;
          store_id: string;
        };
        Update: {
          staff_id?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_store_access_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_store_access_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          id: string;
          brand_id: string | null;
          name: string;
          store_code: string | null;
          store_type: "direct" | "fc";
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id?: string | null;
          name: string;
          store_code?: string | null;
          store_type?: "direct" | "fc";
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string | null;
          name?: string;
          store_code?: string | null;
          store_type?: "direct" | "fc";
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stores_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
        ];
      };
      reply_templates: {
        Row: {
          id: string;
          name: string;
          body: string;
          channel: Database["public"]["Enums"]["inquiry_channel"] | null;
          store_id: string | null;
          brand_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          body: string;
          channel?: Database["public"]["Enums"]["inquiry_channel"] | null;
          store_id?: string | null;
          brand_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          body?: string;
          channel?: Database["public"]["Enums"]["inquiry_channel"] | null;
          store_id?: string | null;
          brand_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          inquiry_id: string;
          staff_id: string;
          remind_at: string;
          note: string | null;
          is_done: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          staff_id: string;
          remind_at: string;
          note?: string | null;
          is_done?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          inquiry_id?: string;
          staff_id?: string;
          remind_at?: string;
          note?: string | null;
          is_done?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      inquiry_reads: {
        Row: {
          inquiry_id: string;
          staff_id: string;
          read_at: string;
        };
        Insert: {
          inquiry_id: string;
          staff_id: string;
          read_at?: string;
        };
        Update: {
          inquiry_id?: string;
          staff_id?: string;
          read_at?: string;
        };
        Relationships: [];
      };
      inquiry_items: {
        Row: {
          id: string;
          inquiry_id: string;
          lead_id: string | null;
          item_name: string;
          brand: string | null;
          model_number: string | null;
          condition: 'N' | 'S' | 'A' | 'B' | 'C' | 'D' | 'J' | '不明' | 'その他' | null;
          accessories: string | null;
          estimated_price_min: number | null;
          estimated_price_max: number | null;
          quote_type: 'upper' | 'around' | 'exact' | 'range' | null;
          quote_price_min: number | null;
          quote_price_max: number | null;
          notes: string | null;
          ai_extracted: boolean;
          source_message_id: string | null;
          quote_status: 'pending' | 'approved' | 'needs_correction';
          quote_reviewed_by: string | null;
          quote_reviewed_at: string | null;
          quote_review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          lead_id?: string | null;
          item_name: string;
          brand?: string | null;
          model_number?: string | null;
          condition?: 'N' | 'S' | 'A' | 'B' | 'C' | 'D' | 'J' | '不明' | 'その他' | null;
          accessories?: string | null;
          estimated_price_min?: number | null;
          estimated_price_max?: number | null;
          quote_type?: 'upper' | 'around' | 'exact' | 'range' | null;
          quote_price_min?: number | null;
          quote_price_max?: number | null;
          notes?: string | null;
          ai_extracted?: boolean;
          source_message_id?: string | null;
          quote_status?: 'pending' | 'approved' | 'needs_correction';
          quote_reviewed_by?: string | null;
          quote_reviewed_at?: string | null;
          quote_review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          inquiry_id?: string;
          lead_id?: string | null;
          item_name?: string;
          brand?: string | null;
          model_number?: string | null;
          condition?: 'N' | 'S' | 'A' | 'B' | 'C' | 'D' | 'J' | '不明' | 'その他' | null;
          accessories?: string | null;
          estimated_price_min?: number | null;
          estimated_price_max?: number | null;
          quote_type?: 'upper' | 'around' | 'exact' | 'range' | null;
          quote_price_min?: number | null;
          quote_price_max?: number | null;
          notes?: string | null;
          ai_extracted?: boolean;
          source_message_id?: string | null;
          quote_status?: 'pending' | 'approved' | 'needs_correction';
          quote_reviewed_by?: string | null;
          quote_reviewed_at?: string | null;
          quote_review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inquiry_items_inquiry_id_fkey";
            columns: ["inquiry_id"];
            isOneToOne: false;
            referencedRelation: "inquiries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiry_items_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inquiry_items_source_message_id_fkey";
            columns: ["source_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      update_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: {
      inquiry_channel:
        | "line"
        | "phone"
        | "web_form"
        | "email"
        | "hikakaku"
        | "uridoki"
        | "oikura";
      inquiry_status:
        | "new"
        | "in_progress"
        | "pending"
        | "appointment_set"
        | "transferred"
        | "lost"
        | "closed";
      message_direction: "inbound" | "outbound";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Inquiry = Database["public"]["Tables"]["inquiries"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Staff = Database["public"]["Tables"]["staff"]["Row"];
export type InquiryTag = Database["public"]["Tables"]["inquiry_tags"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type Store = Database["public"]["Tables"]["stores"]["Row"];
export type LineAccount = Database["public"]["Tables"]["line_accounts"]["Row"];
export type EmailAccount = Database["public"]["Tables"]["email_accounts"]["Row"];
export type ComparisonSiteAccount =
  Database["public"]["Tables"]["comparison_site_accounts"]["Row"];
export type PhoneNumber = Database["public"]["Tables"]["phone_numbers"]["Row"];
export type StaffBrandAccess =
  Database["public"]["Tables"]["staff_brand_access"]["Row"];

export type ReplyTemplate =
  Database["public"]["Tables"]["reply_templates"]["Row"];
export type Reminder = Database["public"]["Tables"]["reminders"]["Row"];
export type InquiryRead = Database["public"]["Tables"]["inquiry_reads"]["Row"];
export type StaffStoreAccess =
  Database["public"]["Tables"]["staff_store_access"]["Row"];
export type InquiryChannel = Database["public"]["Enums"]["inquiry_channel"];
export type InquiryStatus = Database["public"]["Enums"]["inquiry_status"];
export type MessageDirection = Database["public"]["Enums"]["message_direction"];

// shifts / business_hours は migration 008 で追加（generated types 未反映のため手動定義）
export type Shift = {
  id: string;
  staff_id: string;
  shift_date: string;   // "YYYY-MM-DD"
  start_time: string;   // "HH:MM"
  end_time: string;     // "HH:MM"
  break_minutes: number;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type BusinessHour = {
  id: string;
  day_of_week: number;  // 0=日, 1=月 ... 6=土
  open_time: string;    // "HH:MM"
  close_time: string;   // "HH:MM"
  is_closed: boolean;
};

export type InquiryWithLead = Inquiry & {
  leads: Lead | null;
  staff: Pick<Staff, "id" | "name" | "email"> | null;
  brands?: Pick<Brand, "id" | "name" | "brand_code"> | null;
  stores?: Pick<Store, "id" | "name" | "store_code" | "store_type"> | null;
  line_accounts?: Pick<LineAccount, "id" | "name" | "destination"> | null;
  email_accounts?: Pick<EmailAccount, "id" | "email" | "display_name"> | null;
  comparison_site_accounts?: Pick<
    ComparisonSiteAccount,
    "id" | "site" | "notification_email"
  > | null;
  inquiry_tags?: InquiryTag[];
};

export type TagMaster = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type AssignmentRule = {
  id: string;
  name: string;
  channel: string | null;
  keyword: string | null;
  assigned_staff_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
};

// AI学習自動化システム（migration 012）
export type PromptVersion = {
  id: string; msg_category: string; theme: string | null;
  prompt_type: string; content: string; version: number;
  is_active: boolean; total_uses: number; edit_count: number;
  edit_rate: number | null; created_by: string; note: string | null;
  activated_at: string | null; deactivated_at: string | null; created_at: string;
};
export type ReplyExample = {
  id: string; msg_category: string; theme: string;
  customer_message: string; reply_body: string;
  was_ai_generated: boolean; edit_distance: number | null;
  ai_edit_reason: string | null; was_auto_sent: boolean;
  quality_score: number | null; is_selected_for_prompt: boolean;
  message_id: string | null; inquiry_id: string | null; created_at: string;
};
export type AiLearningRun = {
  id: string; trigger: string; status: string;
  messages_analyzed: number | null; date_range_start: string | null;
  date_range_end: string | null; categories_improved: string[] | null;
  new_examples_added: number | null; prompts_updated: number | null;
  summary: Record<string, unknown> | null; error_message: string | null;
  started_at: string; completed_at: string | null;
};
export type AutoSendRule = {
  id: string; msg_category: string; auto_send_enabled: boolean;
  edit_rate_threshold: number; min_sample_size: number;
  review_delay_minutes: number; channel: string | null;
  current_edit_rate: number | null; current_sample_count: number | null;
  last_evaluated_at: string | null; updated_at: string;
};

export type InquiryItemCondition = 'N' | 'S' | 'A' | 'B' | 'C' | 'D' | 'J' | '不明' | 'その他';
export type InquiryItemQuoteType = 'upper' | 'around' | 'exact' | 'range';

export type InquiryItem = {
  id: string;
  inquiry_id: string;
  lead_id: string | null;
  item_name: string;
  brand: string | null;
  model_number: string | null;
  condition: InquiryItemCondition | null;
  accessories: string | null;
  estimated_price_min: number | null;
  estimated_price_max: number | null;
  quote_type: InquiryItemQuoteType | null;
  quote_price_min: number | null;
  quote_price_max: number | null;
  notes: string | null;
  ai_extracted: boolean;
  source_message_id: string | null;
  quote_status: 'pending' | 'approved' | 'needs_correction';
  quote_reviewed_by: string | null;
  quote_reviewed_at: string | null;
  quote_review_note: string | null;
  created_at: string;
  updated_at: string;
};
