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
      inquiries: {
        Row: {
          id: string;
          lead_id: string | null;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id?: string | null;
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
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string | null;
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
            foreignKeyName: "inquiries_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "staff";
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
      messages: {
        Row: {
          id: string;
          inquiry_id: string;
          direction: Database["public"]["Enums"]["message_direction"];
          body: string | null;
          media_urls: string[] | null;
          line_msg_id: string | null;
          sent_by: string | null;
          is_auto: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          direction: Database["public"]["Enums"]["message_direction"];
          body?: string | null;
          media_urls?: string[] | null;
          line_msg_id?: string | null;
          sent_by?: string | null;
          is_auto?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          inquiry_id?: string;
          direction?: Database["public"]["Enums"]["message_direction"];
          body?: string | null;
          media_urls?: string[] | null;
          line_msg_id?: string | null;
          sent_by?: string | null;
          is_auto?: boolean;
          created_at?: string;
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
      staff: {
        Row: {
          id: string;
          auth_id: string | null;
          name: string;
          email: string;
          role: "admin" | "operator" | "viewer";
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_id?: string | null;
          name: string;
          email: string;
          role?: "admin" | "operator" | "viewer";
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_id?: string | null;
          name?: string;
          email?: string;
          role?: "admin" | "operator" | "viewer";
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
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
export type InquiryChannel = Database["public"]["Enums"]["inquiry_channel"];
export type InquiryStatus = Database["public"]["Enums"]["inquiry_status"];
export type MessageDirection = Database["public"]["Enums"]["message_direction"];

export type InquiryWithLead = Inquiry & {
  leads: Lead | null;
  staff: Pick<Staff, "id" | "name" | "email"> | null;
  inquiry_tags?: InquiryTag[];
};
