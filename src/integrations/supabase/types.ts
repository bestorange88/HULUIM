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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_accounts: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          totp_enabled: boolean | null
          totp_secret: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          totp_enabled?: boolean | null
          totp_secret?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_username: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_username: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_username?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_gifts: {
        Row: {
          admin_username: string
          amount: number
          created_at: string
          gift_type: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          admin_username: string
          amount: number
          created_at?: string
          gift_type: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          admin_username?: string
          amount?: number
          created_at?: string
          gift_type?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          last_activity: string | null
          session_token: string
          username: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          last_activity?: string | null
          session_token: string
          username: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          last_activity?: string | null
          session_token?: string
          username?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          content: string
          created_at: string
          id: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      avatar_frames: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          required_tier: string | null
          sort_order: number | null
          style_class: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          required_tier?: string | null
          sort_order?: number | null
          style_class: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          required_tier?: string | null
          sort_order?: number | null
          style_class?: string
        }
        Relationships: []
      }
      bank_cards: {
        Row: {
          bank_name: string
          card_number: string
          cardholder_name: string
          created_at: string
          id: string
          is_default: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_name: string
          card_number: string
          cardholder_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_name?: string
          card_number?: string
          cardholder_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      call_invitations: {
        Row: {
          call_type: string
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          call_type: string
          callee_id: string
          caller_id: string
          conversation_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_type?: string
          callee_id?: string
          caller_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_invitations_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invitations_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invitations_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invitations_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invitations_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invitations_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_invitations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_group_members: {
        Row: {
          added_at: string
          conversation_id: string
          group_id: string
          id: string
        }
        Insert: {
          added_at?: string
          conversation_id: string
          group_id: string
          id?: string
        }
        Update: {
          added_at?: string
          conversation_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_group_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "conversation_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_groups: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          role: Database["public"]["Enums"]["group_member_role"] | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"] | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_settings: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_muted: boolean
          is_pinned: boolean
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_muted?: boolean
          is_pinned?: boolean
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_muted?: boolean
          is_pinned?: boolean
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_settings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          announcement: string | null
          announcement_updated_at: string | null
          avatar_url: string | null
          created_at: string | null
          created_by: string
          description: string | null
          group_note: string | null
          id: string
          name: string | null
          require_approval: boolean | null
          settings: Json | null
          tags: Json | null
          type: Database["public"]["Enums"]["conversation_type"]
          updated_at: string | null
        }
        Insert: {
          announcement?: string | null
          announcement_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          group_note?: string | null
          id?: string
          name?: string | null
          require_approval?: boolean | null
          settings?: Json | null
          tags?: Json | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string | null
        }
        Update: {
          announcement?: string | null
          announcement_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          group_note?: string | null
          id?: string
          name?: string | null
          require_approval?: boolean | null
          settings?: Json | null
          tags?: Json | null
          type?: Database["public"]["Enums"]["conversation_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_transactions: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          id: string
          notes: string | null
          review_notes: string | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          trc20_address: string
          tx_hash: string | null
          type: string
          updated_at: string
          usdt_amount: number
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trc20_address: string
          tx_hash?: string | null
          type: string
          updated_at?: string
          usdt_amount: number
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          review_notes?: string | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trc20_address?: string
          tx_hash?: string | null
          type?: string
          updated_at?: string
          usdt_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      customer_service_accounts: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          sort_order: number | null
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number | null
          updated_at?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_service_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_check_ins: {
        Row: {
          check_in_date: string
          consecutive_days: number
          created_at: string
          id: string
          points_earned: number
          user_id: string
        }
        Insert: {
          check_in_date?: string
          consecutive_days?: number
          created_at?: string
          id?: string
          points_earned?: number
          user_id: string
        }
        Update: {
          check_in_date?: string
          consecutive_days?: number
          created_at?: string
          id?: string
          points_earned?: number
          user_id?: string
        }
        Relationships: []
      }
      friend_group_members: {
        Row: {
          added_at: string
          friend_id: string
          group_id: string
          id: string
        }
        Insert: {
          added_at?: string
          friend_id: string
          group_id: string
          id?: string
        }
        Update: {
          added_at?: string
          friend_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_group_members_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_group_members_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_group_members_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "friend_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_groups: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string | null
          friend_id: string
          id: string
          status: Database["public"]["Enums"]["friendship_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_id: string
          id?: string
          status?: Database["public"]["Enums"]["friendship_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_id?: string
          id?: string
          status?: Database["public"]["Enums"]["friendship_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          code: string
          conversation_id: string
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          use_count: number | null
        }
        Insert: {
          code: string
          conversation_id: string
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          use_count?: number | null
        }
        Update: {
          code?: string
          conversation_id?: string
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_join_requests: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          invite_code: string | null
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          invite_code?: string | null
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          invite_code?: string | null
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lucky_draws: {
        Row: {
          created_at: string
          id: string
          prize_amount: number
          prize_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          prize_amount: number
          prize_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          prize_amount?: number
          prize_type?: string
          user_id?: string
        }
        Relationships: []
      }
      membership_tiers: {
        Row: {
          benefits: Json
          created_at: string
          daily_check_in_bonus: number | null
          daily_draw_tickets: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
          withdrawal_minimum: number | null
        }
        Insert: {
          benefits?: Json
          created_at?: string
          daily_check_in_bonus?: number | null
          daily_draw_tickets?: number | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
          withdrawal_minimum?: number | null
        }
        Update: {
          benefits?: Json
          created_at?: string
          daily_check_in_bonus?: number | null
          daily_draw_tickets?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
          withdrawal_minimum?: number | null
        }
        Relationships: []
      }
      message_favorites: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          media_url: string | null
          read_by: Json | null
          sender_id: string
          status: string | null
          type: Database["public"]["Enums"]["message_type"] | null
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_url?: string | null
          read_by?: Json | null
          sender_id: string
          status?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_url?: string | null
          read_by?: Json | null
          sender_id?: string
          status?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages_archive: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          media_url: string | null
          read_by: Json | null
          sender_id: string
          status: string | null
          type: Database["public"]["Enums"]["message_type"] | null
          updated_at: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_url?: string | null
          read_by?: Json | null
          sender_id: string
          status?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          media_url?: string | null
          read_by?: Json | null
          sender_id?: string
          status?: string | null
          type?: Database["public"]["Enums"]["message_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      moment_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          moment_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          moment_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          moment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moment_comments_moment_id_fkey"
            columns: ["moment_id"]
            isOneToOne: false
            referencedRelation: "moments"
            referencedColumns: ["id"]
          },
        ]
      }
      moment_likes: {
        Row: {
          created_at: string
          id: string
          moment_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          moment_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moment_likes_moment_id_fkey"
            columns: ["moment_id"]
            isOneToOne: false
            referencedRelation: "moments"
            referencedColumns: ["id"]
          },
        ]
      }
      moments: {
        Row: {
          comments_count: number | null
          content: string
          created_at: string
          id: string
          images: Json | null
          likes_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          images?: Json | null
          likes_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          images?: Json | null
          likes_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      news_articles: {
        Row: {
          author: string | null
          content: string | null
          created_at: string
          description: string | null
          external_id: string | null
          fetched_at: string
          id: string
          image_url: string | null
          published_at: string
          source: string
          title: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          author?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          source: string
          title: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          author?: string | null
          content?: string | null
          created_at?: string
          description?: string | null
          external_id?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          published_at?: string
          source?: string
          title?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          type: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          type?: string | null
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      point_orders: {
        Row: {
          admin_notes: string | null
          contact_info: string | null
          created_at: string
          delivered_at: string | null
          id: string
          points_spent: number
          product_id: string
          shipped_at: string | null
          shipping_address: string | null
          status: string
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          contact_info?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          points_spent: number
          product_id: string
          shipped_at?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          contact_info?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          points_spent?: number
          product_id?: string
          shipped_at?: string | null
          shipping_address?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "point_products"
            referencedColumns: ["id"]
          },
        ]
      }
      point_products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          points_required: number
          sort_order: number
          stock: number | null
          type: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          points_required: number
          sort_order?: number
          stock?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          points_required?: number
          sort_order?: number
          stock?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_frame: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string | null
          display_name: string
          gender: string | null
          id: string
          invite_code: string | null
          is_customer_service: boolean | null
          is_muted: boolean | null
          is_real_name_verified: boolean | null
          last_seen: string | null
          muted_reason: string | null
          muted_until: string | null
          phone: string | null
          referred_by_code: string | null
          status: string | null
          transaction_password_hash: string | null
          updated_at: string | null
          user_id: string | null
          username: string
        }
        Insert: {
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string | null
          display_name: string
          gender?: string | null
          id: string
          invite_code?: string | null
          is_customer_service?: boolean | null
          is_muted?: boolean | null
          is_real_name_verified?: boolean | null
          last_seen?: string | null
          muted_reason?: string | null
          muted_until?: string | null
          phone?: string | null
          referred_by_code?: string | null
          status?: string | null
          transaction_password_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
          username: string
        }
        Update: {
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string | null
          display_name?: string
          gender?: string | null
          id?: string
          invite_code?: string | null
          is_customer_service?: boolean | null
          is_muted?: boolean | null
          is_real_name_verified?: boolean | null
          last_seen?: string | null
          muted_reason?: string | null
          muted_until?: string | null
          phone?: string | null
          referred_by_code?: string | null
          status?: string | null
          transaction_password_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      real_name_verifications: {
        Row: {
          created_at: string
          face_image_url: string | null
          face_video_url: string | null
          id: string
          id_card_back_url: string | null
          id_card_front_url: string | null
          id_card_number: string
          real_name: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          face_image_url?: string | null
          face_video_url?: string | null
          id?: string
          id_card_back_url?: string | null
          id_card_front_url?: string | null
          id_card_number: string
          real_name: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          face_image_url?: string | null
          face_video_url?: string | null
          id?: string
          id_card_back_url?: string | null
          id_card_front_url?: string | null
          id_card_number?: string
          real_name?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "real_name_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_name_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_name_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      red_envelope_claims: {
        Row: {
          amount: number
          claimed_at: string
          id: string
          red_envelope_id: string
          user_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          id?: string
          red_envelope_id: string
          user_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          id?: string
          red_envelope_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_envelope_claims_red_envelope_id_fkey"
            columns: ["red_envelope_id"]
            isOneToOne: false
            referencedRelation: "red_envelopes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      red_envelopes: {
        Row: {
          amount: number
          conversation_id: string
          created_at: string
          designated_user_id: string | null
          expire_at: string
          id: string
          message: string | null
          quantity: number
          remaining_amount: number
          remaining_quantity: number
          sender_id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          conversation_id: string
          created_at?: string
          designated_user_id?: string | null
          expire_at: string
          id?: string
          message?: string | null
          quantity?: number
          remaining_amount: number
          remaining_quantity: number
          sender_id: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          conversation_id?: string
          created_at?: string
          designated_user_id?: string | null
          expire_at?: string
          id?: string
          message?: string | null
          quantity?: number
          remaining_amount?: number
          remaining_quantity?: number
          sender_id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_envelopes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_designated_user_id_fkey"
            columns: ["designated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_designated_user_id_fkey"
            columns: ["designated_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_designated_user_id_fkey"
            columns: ["designated_user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          level: number
          referred_user_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          level: number
          referred_user_id: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          level?: number
          referred_user_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          level_1_reward: number
          level_2_reward: number
          level_3_reward: number
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          level_1_reward?: number
          level_2_reward?: number
          level_3_reward?: number
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          level_1_reward?: number
          level_2_reward?: number
          level_3_reward?: number
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          level: number
          referrer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: number
          referrer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          referrer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      sensitive_words: {
        Row: {
          action: string | null
          category: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          word: string
        }
        Insert: {
          action?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          word: string
        }
        Update: {
          action?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          word?: string
        }
        Relationships: []
      }
      shipping_addresses: {
        Row: {
          city: string
          created_at: string
          detailed_address: string
          district: string
          id: string
          is_default: boolean
          phone: string
          province: string
          receiver_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          created_at?: string
          detailed_address: string
          district: string
          id?: string
          is_default?: boolean
          phone: string
          province: string
          receiver_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          created_at?: string
          detailed_address?: string
          district?: string
          id?: string
          is_default?: boolean
          phone?: string
          province?: string
          receiver_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sms_verification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          is_valid: boolean
          phone: string
          purpose: string
          used_at: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          is_valid?: boolean
          phone: string
          purpose: string
          used_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_valid?: boolean
          phone?: string
          purpose?: string
          used_at?: string | null
        }
        Relationships: []
      }
      system_messages: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          priority: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          priority?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          priority?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          accepted_at: string | null
          amount: number
          conversation_id: string
          created_at: string
          expire_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          amount: number
          conversation_id: string
          created_at?: string
          expire_at: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          amount?: number
          conversation_id?: string
          created_at?: string
          expire_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_deleted_messages: {
        Row: {
          conversation_id: string
          deleted_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          deleted_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          deleted_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_feedbacks: {
        Row: {
          admin_response: string | null
          contact_info: string | null
          content: string
          created_at: string
          id: string
          status: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          contact_info?: string | null
          content: string
          created_at?: string
          id?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          contact_info?: string | null
          content?: string
          created_at?: string
          id?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_memberships: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          payment_amount: number
          payment_method: string | null
          purchased_at: string
          tier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          payment_amount: number
          payment_method?: string | null
          purchased_at?: string
          tier_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          payment_amount?: number
          payment_method?: string | null
          purchased_at?: string
          tier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_memberships_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "membership_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          frozen_balance: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          frozen_balance?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          frozen_balance?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "safe_public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      archive_stats: {
        Row: {
          archive_size: string | null
          archived_messages: number | null
          newest_message: string | null
          oldest_message: string | null
        }
        Relationships: []
      }
      messages_stats: {
        Row: {
          deleted_messages: number | null
          messages_last_24h: number | null
          messages_last_30d: number | null
          messages_last_7d: number | null
          table_size: string | null
          total_messages: number | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          last_seen: string | null
          status: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          last_seen?: string | null
          status?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string | null
          last_seen?: string | null
          status?: string | null
          username?: string | null
        }
        Relationships: []
      }
      safe_public_profiles: {
        Row: {
          avatar_frame: string | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string | null
          display_name: string | null
          gender: string | null
          id: string | null
          last_seen: string | null
          status: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string | null
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_frame?: string | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string | null
          display_name?: string | null
          gender?: string | null
          id?: string | null
          last_seen?: string | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_transfer_with_balance: {
        Args: { transfer_id: string }
        Returns: Json
      }
      archive_old_messages: { Args: never; Returns: number }
      claim_red_envelope_with_balance: {
        Args: { envelope_id: string }
        Returns: Json
      }
      cleanup_expired_admin_sessions: { Args: never; Returns: undefined }
      cleanup_expired_sms_codes: { Args: never; Returns: undefined }
      create_direct_conversation: {
        Args: { friend_id: string }
        Returns: string
      }
      create_group_conversation: {
        Args: { name: string; participant_ids: string[] }
        Returns: string
      }
      decrement_moment_likes: {
        Args: { moment_id: string }
        Returns: undefined
      }
      dissolve_group: { Args: { _conversation_id: string }; Returns: Json }
      generate_alo_id: { Args: never; Returns: string }
      generate_short_invite_code: { Args: never; Returns: string }
      get_public_profile: {
        Args: { profile_id: string }
        Returns: {
          avatar_url: string
          bio: string
          birth_date: string
          display_name: string
          gender: string
          id: string
          last_seen: string
          status: string
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_moment_likes: {
        Args: { moment_id: string }
        Returns: undefined
      }
      is_conversation_creator: {
        Args: { _conversation_id: string; _user_id?: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { _conversation_id: string; _user_id?: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _conversation_id: string; _user_id?: string }
        Returns: boolean
      }
      join_group_via_invite: { Args: { invite_code: string }; Returns: Json }
      log_admin_action: {
        Args: {
          p_action: string
          p_admin_username: string
          p_details?: Json
          p_ip_address?: string
          p_resource_id?: string
          p_resource_type?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      mark_messages_as_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      remove_group_member: {
        Args: { _conversation_id: string; _target_user_id: string }
        Returns: Json
      }
      send_red_envelope_with_balance:
        | {
            Args: {
              p_amount: number
              p_conversation_id: string
              p_designated_user_id?: string
              p_message?: string
              p_quantity: number
              p_type: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
              p_conversation_id: string
              p_message: string
              p_quantity: number
              p_type: string
            }
            Returns: Json
          }
      send_transfer_with_balance: {
        Args: {
          p_amount: number
          p_conversation_id: string
          p_message: string
          p_receiver_id: string
        }
        Returns: Json
      }
      transfer_group_ownership: {
        Args: { _conversation_id: string; _new_owner_id: string }
        Returns: Json
      }
      update_admin_password: {
        Args: { p_new_password: string; p_username: string }
        Returns: undefined
      }
      update_group_member_role: {
        Args: {
          _conversation_id: string
          _new_role: Database["public"]["Enums"]["group_member_role"]
          _target_user_id: string
        }
        Returns: Json
      }
      verify_password: {
        Args: { p_password: string; p_username: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
      conversation_type: "direct" | "group"
      friendship_status: "pending" | "accepted" | "blocked"
      group_member_role: "owner" | "admin" | "member"
      message_type: "text" | "image" | "video" | "audio" | "file" | "emoji"
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
      app_role: ["super_admin", "admin", "user"],
      conversation_type: ["direct", "group"],
      friendship_status: ["pending", "accepted", "blocked"],
      group_member_role: ["owner", "admin", "member"],
      message_type: ["text", "image", "video", "audio", "file", "emoji"],
    },
  },
} as const
