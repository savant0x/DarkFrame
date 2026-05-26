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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_username: string
          created_at: string
          details: Json
          id: string
          target: string | null
        }
        Insert: {
          action: string
          admin_username: string
          created_at?: string
          details?: Json
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          admin_username?: string
          created_at?: string
          details?: Json
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      auction_bids: {
        Row: {
          auction_id: string
          bid_amount: number
          bid_auction_id: string
          bid_time: string
          bidder_username: string
          id: string
          is_winning: boolean
        }
        Insert: {
          auction_id: string
          bid_amount: number
          bid_auction_id: string
          bid_time?: string
          bidder_username: string
          id?: string
          is_winning?: boolean
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          bid_auction_id?: string
          bid_time?: string
          bidder_username?: string
          id?: string
          is_winning?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auction_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_listings: {
        Row: {
          auction_id: string
          buyout_price: number | null
          clan_only: boolean
          closed_at: string | null
          created_at: string
          current_bid: number
          duration_hours: number
          expires_at: string
          final_price: number | null
          highest_bidder: string | null
          id: string
          item_type: Database["public"]["Enums"]["auction_item_type"]
          listing_fee: number
          reserve_price: number | null
          resource_amount: number | null
          resource_type: Database["public"]["Enums"]["resource_type"] | null
          sale_fee: number
          seller_clan: string | null
          seller_username: string
          settled: boolean
          settled_at: string | null
          starting_bid: number
          status: Database["public"]["Enums"]["auction_status"]
          tradeable_item_quantity: number | null
          unit_defense: number | null
          unit_id: string | null
          unit_strength: number | null
          unit_type: Database["public"]["Enums"]["unit_type"] | null
          winner_username: string | null
        }
        Insert: {
          auction_id: string
          buyout_price?: number | null
          clan_only?: boolean
          closed_at?: string | null
          created_at?: string
          current_bid: number
          duration_hours: number
          expires_at: string
          final_price?: number | null
          highest_bidder?: string | null
          id?: string
          item_type: Database["public"]["Enums"]["auction_item_type"]
          listing_fee: number
          reserve_price?: number | null
          resource_amount?: number | null
          resource_type?: Database["public"]["Enums"]["resource_type"] | null
          sale_fee?: number
          seller_clan?: string | null
          seller_username: string
          settled?: boolean
          settled_at?: string | null
          starting_bid: number
          status?: Database["public"]["Enums"]["auction_status"]
          tradeable_item_quantity?: number | null
          unit_defense?: number | null
          unit_id?: string | null
          unit_strength?: number | null
          unit_type?: Database["public"]["Enums"]["unit_type"] | null
          winner_username?: string | null
        }
        Update: {
          auction_id?: string
          buyout_price?: number | null
          clan_only?: boolean
          closed_at?: string | null
          created_at?: string
          current_bid?: number
          duration_hours?: number
          expires_at?: string
          final_price?: number | null
          highest_bidder?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["auction_item_type"]
          listing_fee?: number
          reserve_price?: number | null
          resource_amount?: number | null
          resource_type?: Database["public"]["Enums"]["resource_type"] | null
          sale_fee?: number
          seller_clan?: string | null
          seller_username?: string
          settled?: boolean
          settled_at?: string | null
          starting_bid?: number
          status?: Database["public"]["Enums"]["auction_status"]
          tradeable_item_quantity?: number | null
          unit_defense?: number | null
          unit_id?: string | null
          unit_strength?: number | null
          unit_type?: Database["public"]["Enums"]["unit_type"] | null
          winner_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_listings_seller_username_fkey"
            columns: ["seller_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      auction_notifications: {
        Row: {
          auction_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          username: string
        }
        Insert: {
          auction_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          username: string
        }
        Update: {
          auction_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          username?: string
        }
        Relationships: []
      }
      battle_logs: {
        Row: {
          attacker_strength: number
          attacker_username: string
          created_at: string
          damage_dealt: number
          defender_defense: number
          defender_username: string
          id: string
          outcome: string
          resources_stolen: Json | null
        }
        Insert: {
          attacker_strength: number
          attacker_username: string
          created_at?: string
          damage_dealt: number
          defender_defense: number
          defender_username: string
          id?: string
          outcome: string
          resources_stolen?: Json | null
        }
        Update: {
          attacker_strength?: number
          attacker_username?: string
          created_at?: string
          damage_dealt?: number
          defender_defense?: number
          defender_username?: string
          id?: string
          outcome?: string
          resources_stolen?: Json | null
        }
        Relationships: []
      }
      beer_base_defeat_events: {
        Row: {
          alive_seconds: number
          created_at: string
          defeated_by: string
          id: string
          rewards: Json
          tier: number
        }
        Insert: {
          alive_seconds: number
          created_at: string
          defeated_by: string
          id?: string
          rewards?: Json
          tier: number
        }
        Update: {
          alive_seconds?: number
          created_at?: string
          defeated_by?: string
          id?: string
          rewards?: Json
          tier?: number
        }
        Relationships: []
      }
      beer_base_spawn_events: {
        Row: {
          created_at: string
          id: string
          position_x: number
          position_y: number
          schedule_id: string | null
          spawned_by: string
          tier: number
        }
        Insert: {
          created_at: string
          id?: string
          position_x: number
          position_y: number
          schedule_id?: string | null
          spawned_by: string
          tier: number
        }
        Update: {
          created_at?: string
          id?: string
          position_x?: number
          position_y?: number
          schedule_id?: string | null
          spawned_by?: string
          tier?: number
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_username: string
          blocker_username: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_username: string
          blocker_username: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_username?: string
          blocker_username?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_username_fkey"
            columns: ["blocked_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
          {
            foreignKeyName: "blocked_users_blocker_username_fkey"
            columns: ["blocker_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      bot_config: {
        Row: {
          config_key: string
          config_value: Json
          id: string
        }
        Insert: {
          config_key: string
          config_value: Json
          id?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: string
        }
        Relationships: []
      }
      bot_magnet_beacons: {
        Row: {
          active: boolean | null
          attraction_chance: number | null
          attraction_radius: number | null
          bots_attracted: number | null
          cooldown_until: string | null
          deployed_at: string | null
          expires_at: string
          id: string
          player_id: string
          player_name: string
          x: number
          y: number
        }
        Insert: {
          active?: boolean | null
          attraction_chance?: number | null
          attraction_radius?: number | null
          bots_attracted?: number | null
          cooldown_until?: string | null
          deployed_at?: string | null
          expires_at: string
          id?: string
          player_id: string
          player_name: string
          x: number
          y: number
        }
        Update: {
          active?: boolean | null
          attraction_chance?: number | null
          attraction_radius?: number | null
          bots_attracted?: number | null
          cooldown_until?: string | null
          deployed_at?: string | null
          expires_at?: string
          id?: string
          player_id?: string
          player_name?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "bot_magnet_beacons_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      bots: {
        Row: {
          attack_cooldown: string | null
          base_x: number
          base_y: number
          bounty_value: number
          created_at: string
          current_x: number
          current_y: number
          defeated_count: number
          id: string
          is_bot: boolean
          is_special_base: boolean
          last_defeated: string | null
          last_growth: string
          last_resource_regen: string | null
          movement: Database["public"]["Enums"]["bot_movement"]
          nest_affinity: number | null
          permanent_base: boolean
          reputation: Database["public"]["Enums"]["bot_reputation"]
          resources_energy: number
          resources_metal: number
          revenge_target: string | null
          specialization: Database["public"]["Enums"]["bot_specialization"]
          summoned_at: string | null
          summoned_by: string | null
          tier: number
          total_defense: number
          total_strength: number
          username: string
          zone: number
        }
        Insert: {
          attack_cooldown?: string | null
          base_x: number
          base_y: number
          bounty_value?: number
          created_at?: string
          current_x: number
          current_y: number
          defeated_count?: number
          id?: string
          is_bot?: boolean
          is_special_base?: boolean
          last_defeated?: string | null
          last_growth?: string
          last_resource_regen?: string | null
          movement?: Database["public"]["Enums"]["bot_movement"]
          nest_affinity?: number | null
          permanent_base?: boolean
          reputation?: Database["public"]["Enums"]["bot_reputation"]
          resources_energy?: number
          resources_metal?: number
          revenge_target?: string | null
          specialization?: Database["public"]["Enums"]["bot_specialization"]
          summoned_at?: string | null
          summoned_by?: string | null
          tier?: number
          total_defense?: number
          total_strength?: number
          username: string
          zone?: number
        }
        Update: {
          attack_cooldown?: string | null
          base_x?: number
          base_y?: number
          bounty_value?: number
          created_at?: string
          current_x?: number
          current_y?: number
          defeated_count?: number
          id?: string
          is_bot?: boolean
          is_special_base?: boolean
          last_defeated?: string | null
          last_growth?: string
          last_resource_regen?: string | null
          movement?: Database["public"]["Enums"]["bot_movement"]
          nest_affinity?: number | null
          permanent_base?: boolean
          reputation?: Database["public"]["Enums"]["bot_reputation"]
          resources_energy?: number
          resources_metal?: number
          revenge_target?: string | null
          specialization?: Database["public"]["Enums"]["bot_specialization"]
          summoned_at?: string | null
          summoned_by?: string | null
          tier?: number
          total_defense?: number
          total_strength?: number
          username?: string
          zone?: number
        }
        Relationships: [
          {
            foreignKeyName: "bots_summoned_by_fkey"
            columns: ["summoned_by"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel: string
          created_at: string
          deleted: boolean
          edited_at: string | null
          id: string
          message: string
          sender_id: string
          sender_username: string
        }
        Insert: {
          channel: string
          created_at?: string
          deleted?: boolean
          edited_at?: string | null
          id?: string
          message: string
          sender_id: string
          sender_username: string
        }
        Update: {
          channel?: string
          created_at?: string
          deleted?: boolean
          edited_at?: string | null
          id?: string
          message?: string
          sender_id?: string
          sender_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      clan_activity: {
        Row: {
          activity_type: Database["public"]["Enums"]["clan_activity_type"]
          clan_id: string
          created_at: string
          details: Json
          id: string
          player_id: string | null
          username: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["clan_activity_type"]
          clan_id: string
          created_at?: string
          details?: Json
          id?: string
          player_id?: string | null
          username?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["clan_activity_type"]
          clan_id?: string
          created_at?: string
          details?: Json
          id?: string
          player_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clan_activity_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_alliances: {
        Row: {
          accepted_at: string | null
          alliance_type: Database["public"]["Enums"]["alliance_type"]
          broken_at: string | null
          clan_a_id: string
          clan_b_id: string
          contracts: Json
          id: string
          proposed_at: string
          status: Database["public"]["Enums"]["alliance_status"]
        }
        Insert: {
          accepted_at?: string | null
          alliance_type: Database["public"]["Enums"]["alliance_type"]
          broken_at?: string | null
          clan_a_id: string
          clan_b_id: string
          contracts?: Json
          id?: string
          proposed_at?: string
          status?: Database["public"]["Enums"]["alliance_status"]
        }
        Update: {
          accepted_at?: string | null
          alliance_type?: Database["public"]["Enums"]["alliance_type"]
          broken_at?: string | null
          clan_a_id?: string
          clan_b_id?: string
          contracts?: Json
          id?: string
          proposed_at?: string
          status?: Database["public"]["Enums"]["alliance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clan_alliances_clan_a_id_fkey"
            columns: ["clan_a_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_alliances_clan_b_id_fkey"
            columns: ["clan_b_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_bank_transactions: {
        Row: {
          amount_energy: number
          amount_metal: number
          amount_rp: number
          clan_id: string
          created_at: string
          description: string | null
          id: string
          player_id: string | null
          transaction_type: Database["public"]["Enums"]["clan_bank_tx_type"]
          username: string | null
        }
        Insert: {
          amount_energy?: number
          amount_metal?: number
          amount_rp?: number
          clan_id: string
          created_at?: string
          description?: string | null
          id?: string
          player_id?: string | null
          transaction_type: Database["public"]["Enums"]["clan_bank_tx_type"]
          username?: string | null
        }
        Update: {
          amount_energy?: number
          amount_metal?: number
          amount_rp?: number
          clan_id?: string
          created_at?: string
          description?: string | null
          id?: string
          player_id?: string | null
          transaction_type?: Database["public"]["Enums"]["clan_bank_tx_type"]
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clan_bank_transactions_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_chat_messages: {
        Row: {
          channel: string
          clan_id: string
          created_at: string
          deleted: boolean
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["clan_role"]
        }
        Insert: {
          channel?: string
          clan_id: string
          created_at?: string
          deleted?: boolean
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_role: Database["public"]["Enums"]["clan_role"]
        }
        Update: {
          channel?: string
          clan_id?: string
          created_at?: string
          deleted?: boolean
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["clan_role"]
        }
        Relationships: [
          {
            foreignKeyName: "clan_chat_messages_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_invitations: {
        Row: {
          clan_id: string
          clan_name: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string
          invited_player: string
          status: string
        }
        Insert: {
          clan_id: string
          clan_name: string
          expires_at: string
          id?: string
          invited_at?: string
          invited_by: string
          invited_player: string
          status?: string
        }
        Update: {
          clan_id?: string
          clan_name?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string
          invited_player?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_invitations_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_members: {
        Row: {
          clan_id: string
          id: string
          joined_at: string
          last_active: string
          player_id: string
          role: Database["public"]["Enums"]["clan_role"]
          username: string
        }
        Insert: {
          clan_id: string
          id?: string
          joined_at?: string
          last_active?: string
          player_id: string
          role?: Database["public"]["Enums"]["clan_role"]
          username: string
        }
        Update: {
          clan_id?: string
          id?: string
          joined_at?: string
          last_active?: string
          player_id?: string
          role?: Database["public"]["Enums"]["clan_role"]
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      clan_milestones: {
        Row: {
          clan_id: string
          completed_at: string
          id: string
          level: number
          reward_energy: number
          reward_metal: number
          reward_rp: number
        }
        Insert: {
          clan_id: string
          completed_at?: string
          id?: string
          level: number
          reward_energy: number
          reward_metal: number
          reward_rp: number
        }
        Update: {
          clan_id?: string
          completed_at?: string
          id?: string
          level?: number
          reward_energy?: number
          reward_metal?: number
          reward_rp?: number
        }
        Relationships: [
          {
            foreignKeyName: "clan_milestones_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_perks: {
        Row: {
          activated_at: string
          activated_by: string | null
          bonus_type: string
          bonus_value: number
          category: Database["public"]["Enums"]["clan_perk_category"]
          clan_id: string
          cost_energy: number
          cost_metal: number
          cost_rp: number
          description: string | null
          id: string
          name: string
          perk_id: string
          required_level: number
          tier: Database["public"]["Enums"]["clan_perk_tier"]
        }
        Insert: {
          activated_at?: string
          activated_by?: string | null
          bonus_type: string
          bonus_value: number
          category: Database["public"]["Enums"]["clan_perk_category"]
          clan_id: string
          cost_energy: number
          cost_metal: number
          cost_rp: number
          description?: string | null
          id?: string
          name: string
          perk_id: string
          required_level: number
          tier: Database["public"]["Enums"]["clan_perk_tier"]
        }
        Update: {
          activated_at?: string
          activated_by?: string | null
          bonus_type?: string
          bonus_value?: number
          category?: Database["public"]["Enums"]["clan_perk_category"]
          clan_id?: string
          cost_energy?: number
          cost_metal?: number
          cost_rp?: number
          description?: string | null
          id?: string
          name?: string
          perk_id?: string
          required_level?: number
          tier?: Database["public"]["Enums"]["clan_perk_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "clan_perks_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_territories: {
        Row: {
          claimed_at: string
          claimed_by: string
          clan_id: string
          defense_bonus: number
          id: string
          territory_type: string
          tile_x: number
          tile_y: number
        }
        Insert: {
          claimed_at?: string
          claimed_by: string
          clan_id: string
          defense_bonus?: number
          id?: string
          territory_type?: string
          tile_x: number
          tile_y: number
        }
        Update: {
          claimed_at?: string
          claimed_by?: string
          clan_id?: string
          defense_bonus?: number
          id?: string
          territory_type?: string
          tile_x?: number
          tile_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "clan_territories_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_territories_tile_x_tile_y_fkey"
            columns: ["tile_x", "tile_y"]
            isOneToOne: false
            referencedRelation: "tiles"
            referencedColumns: ["x", "y"]
          },
        ]
      }
      clan_wars: {
        Row: {
          attacker_battles_won: number
          attacker_clan_id: string
          attacker_territory_gained: number
          cost_energy: number
          cost_metal: number
          declared_at: string
          defender_battles_won: number
          defender_clan_id: string
          defender_territory_gained: number
          ended_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["clan_war_status"]
          war_id: string
          winner_clan_id: string | null
        }
        Insert: {
          attacker_battles_won?: number
          attacker_clan_id: string
          attacker_territory_gained?: number
          cost_energy?: number
          cost_metal?: number
          declared_at?: string
          defender_battles_won?: number
          defender_clan_id: string
          defender_territory_gained?: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["clan_war_status"]
          war_id: string
          winner_clan_id?: string | null
        }
        Update: {
          attacker_battles_won?: number
          attacker_clan_id?: string
          attacker_territory_gained?: number
          cost_energy?: number
          cost_metal?: number
          declared_at?: string
          defender_battles_won?: number
          defender_clan_id?: string
          defender_territory_gained?: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["clan_war_status"]
          war_id?: string
          winner_clan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clan_wars_attacker_clan_id_fkey"
            columns: ["attacker_clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_wars_defender_clan_id_fkey"
            columns: ["defender_clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clan_wars_winner_clan_id_fkey"
            columns: ["winner_clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          active_research: string | null
          bank_capacity: number
          bank_tax_energy: number
          bank_tax_metal: number
          bank_tax_rp: number
          bank_treasury_energy: number
          bank_treasury_metal: number
          bank_treasury_rp: number
          bank_upgrade_level: number
          clan_level: number
          clan_settings: Json
          created_at: string
          current_level_xp: number
          description: string
          id: string
          last_level_up: string | null
          last_xp_gain: string | null
          leader_id: string
          max_members: number
          name: string
          prestige_badge: string | null
          research_points: number
          tag: string
          total_monuments: number
          total_power: number
          total_rp: number
          total_territories: number
          total_xp: number
          unlocked_research: string[]
          wars_lost: number
          wars_won: number
          xp_to_next_level: number
        }
        Insert: {
          active_research?: string | null
          bank_capacity?: number
          bank_tax_energy?: number
          bank_tax_metal?: number
          bank_tax_rp?: number
          bank_treasury_energy?: number
          bank_treasury_metal?: number
          bank_treasury_rp?: number
          bank_upgrade_level?: number
          clan_level?: number
          clan_settings?: Json
          created_at?: string
          current_level_xp?: number
          description?: string
          id?: string
          last_level_up?: string | null
          last_xp_gain?: string | null
          leader_id: string
          max_members?: number
          name: string
          prestige_badge?: string | null
          research_points?: number
          tag: string
          total_monuments?: number
          total_power?: number
          total_rp?: number
          total_territories?: number
          total_xp?: number
          unlocked_research?: string[]
          wars_lost?: number
          wars_won?: number
          xp_to_next_level?: number
        }
        Update: {
          active_research?: string | null
          bank_capacity?: number
          bank_tax_energy?: number
          bank_tax_metal?: number
          bank_tax_rp?: number
          bank_treasury_energy?: number
          bank_treasury_metal?: number
          bank_treasury_rp?: number
          bank_upgrade_level?: number
          clan_level?: number
          clan_settings?: Json
          created_at?: string
          current_level_xp?: number
          description?: string
          id?: string
          last_level_up?: string | null
          last_xp_gain?: string | null
          leader_id?: string
          max_members?: number
          name?: string
          prestige_badge?: string | null
          research_points?: number
          tag?: string
          total_monuments?: number
          total_power?: number
          total_rp?: number
          total_territories?: number
          total_xp?: number
          unlocked_research?: string[]
          wars_lost?: number
          wars_won?: number
          xp_to_next_level?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message: string | null
          last_message_at: string | null
          participants: string[]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participants?: string[]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          participants?: string[]
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_harvest_progress: {
        Row: {
          energy_harvested: number | null
          harvest_count: number | null
          harvest_date: string
          id: string
          metal_harvested: number | null
          milestones_completed: number[] | null
          total_rp_earned: number | null
          username: string
        }
        Insert: {
          energy_harvested?: number | null
          harvest_count?: number | null
          harvest_date?: string
          id?: string
          metal_harvested?: number | null
          milestones_completed?: number[] | null
          total_rp_earned?: number | null
          username: string
        }
        Update: {
          energy_harvested?: number | null
          harvest_count?: number | null
          harvest_date?: string
          id?: string
          metal_harvested?: number | null
          milestones_completed?: number[] | null
          total_rp_earned?: number | null
          username?: string
        }
        Relationships: []
      }
      factories: {
        Row: {
          defense: number
          id: string
          last_attack_time: string | null
          last_attacked_by: string | null
          last_resource_generation: string | null
          last_slot_regen: string
          level: number
          owner: string | null
          production_rate: number
          slots: number
          used_slots: number
          x: number
          y: number
        }
        Insert: {
          defense?: number
          id?: string
          last_attack_time?: string | null
          last_attacked_by?: string | null
          last_resource_generation?: string | null
          last_slot_regen?: string
          level?: number
          owner?: string | null
          production_rate?: number
          slots?: number
          used_slots?: number
          x: number
          y: number
        }
        Update: {
          defense?: number
          id?: string
          last_attack_time?: string | null
          last_attacked_by?: string | null
          last_resource_generation?: string | null
          last_slot_regen?: string
          level?: number
          owner?: string | null
          production_rate?: number
          slots?: number
          used_slots?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "factories_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      flag_trails: {
        Row: {
          created_at: string
          expires_at: string
          holder_username: string
          id: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          holder_username: string
          id?: string
          x: number
          y: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          holder_username?: string
          id?: string
          x?: number
          y?: number
        }
        Relationships: []
      }
      flags: {
        Row: {
          bearer_id: string | null
          bearer_username: string | null
          bot_config: Json | null
          challenge_active: boolean
          challenge_challenger_id: string | null
          challenge_expires_at: string | null
          challenge_lock_expires_at: string | null
          challenge_started_at: string | null
          claimed_at: string | null
          current_hp: number
          flee_count: number
          grace_until: string | null
          id: string
          is_bot: boolean
          max_hold_expires_at: string | null
          max_hp: number
          position_x: number
          position_y: number
          respawn_at: string | null
          session_energy_earned: number
          session_metal_earned: number
        }
        Insert: {
          bearer_id?: string | null
          bearer_username?: string | null
          bot_config?: Json | null
          challenge_active?: boolean
          challenge_challenger_id?: string | null
          challenge_expires_at?: string | null
          challenge_lock_expires_at?: string | null
          challenge_started_at?: string | null
          claimed_at?: string | null
          current_hp?: number
          flee_count?: number
          grace_until?: string | null
          id?: string
          is_bot?: boolean
          max_hold_expires_at?: string | null
          max_hp?: number
          position_x: number
          position_y: number
          respawn_at?: string | null
          session_energy_earned?: number
          session_metal_earned?: number
        }
        Update: {
          bearer_id?: string | null
          bearer_username?: string | null
          bot_config?: Json | null
          challenge_active?: boolean
          challenge_challenger_id?: string | null
          challenge_expires_at?: string | null
          challenge_lock_expires_at?: string | null
          challenge_started_at?: string | null
          claimed_at?: string | null
          current_hp?: number
          flee_count?: number
          grace_until?: string | null
          id?: string
          is_bot?: boolean
          max_hold_expires_at?: string | null
          max_hp?: number
          position_x?: number
          position_y?: number
          respawn_at?: string | null
          session_energy_earned?: number
          session_metal_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "flags_bearer_id_fkey"
            columns: ["bearer_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          receiver_username: string
          sender_username: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_username: string
          sender_username: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_username?: string
          sender_username?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_username_fkey"
            columns: ["receiver_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
          {
            foreignKeyName: "friend_requests_sender_username_fkey"
            columns: ["sender_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      friends: {
        Row: {
          created_at: string | null
          friend_username: string
          id: string
          user_username: string
        }
        Insert: {
          created_at?: string | null
          friend_username: string
          id?: string
          user_username: string
        }
        Update: {
          created_at?: string | null
          friend_username?: string
          id?: string
          user_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_friend_username_fkey"
            columns: ["friend_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
          {
            foreignKeyName: "friends_user_username_fkey"
            columns: ["user_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          read: boolean | null
          read_at: string | null
          sender_username: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          sender_username: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          sender_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["vip_tier"]
          user_id: string
          username: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          tier: Database["public"]["Enums"]["vip_tier"]
          user_id: string
          username: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["vip_tier"]
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_achievements: {
        Row: {
          achievement_id: string
          category: Database["public"]["Enums"]["achievement_category"]
          description: string | null
          id: string
          name: string
          player_username: string
          progress: number
          rarity: Database["public"]["Enums"]["achievement_rarity"]
          req_type: string | null
          req_value: number | null
          reward_rp_bonus: number | null
          reward_unit_unlock: string | null
          unlocked_at: string
        }
        Insert: {
          achievement_id: string
          category: Database["public"]["Enums"]["achievement_category"]
          description?: string | null
          id?: string
          name: string
          player_username: string
          progress?: number
          rarity: Database["public"]["Enums"]["achievement_rarity"]
          req_type?: string | null
          req_value?: number | null
          reward_rp_bonus?: number | null
          reward_unit_unlock?: string | null
          unlocked_at?: string
        }
        Update: {
          achievement_id?: string
          category?: Database["public"]["Enums"]["achievement_category"]
          description?: string | null
          id?: string
          name?: string
          player_username?: string
          progress?: number
          rarity?: Database["public"]["Enums"]["achievement_rarity"]
          req_type?: string | null
          req_value?: number | null
          reward_rp_bonus?: number | null
          reward_unit_unlock?: string | null
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_active_boosts: {
        Row: {
          expires_at: string | null
          gathering_boost: number | null
          id: string
          player_username: string
        }
        Insert: {
          expires_at?: string | null
          gathering_boost?: number | null
          id?: string
          player_username: string
        }
        Update: {
          expires_at?: string | null
          gathering_boost?: number | null
          id?: string
          player_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_active_boosts_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_bounties: {
        Row: {
          claimed: boolean
          completed: boolean
          current_defeats: number
          defeats_required: number
          difficulty: string
          energy_reward: number
          id: string
          last_refresh: string
          metal_reward: number
          player_username: string
          unclaimed_rewards: number
          unit_specialization: string
          unit_tier: number
        }
        Insert: {
          claimed?: boolean
          completed?: boolean
          current_defeats?: number
          defeats_required: number
          difficulty: string
          energy_reward: number
          id?: string
          last_refresh?: string
          metal_reward: number
          player_username: string
          unclaimed_rewards?: number
          unit_specialization: string
          unit_tier: number
        }
        Update: {
          claimed?: boolean
          completed?: boolean
          current_defeats?: number
          defeats_required?: number
          difficulty?: string
          energy_reward?: number
          id?: string
          last_refresh?: string
          metal_reward?: number
          player_username?: string
          unclaimed_rewards?: number
          unit_specialization?: string
          unit_tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_bounties_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_concentration_zones: {
        Row: {
          center_x: number
          center_y: number
          id: string
          name: string | null
          player_username: string
          size: number
        }
        Insert: {
          center_x: number
          center_y: number
          id?: string
          name?: string | null
          player_username: string
          size?: number
        }
        Update: {
          center_x?: number
          center_y?: number
          id?: string
          name?: string | null
          player_username?: string
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_concentration_zones_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_discoveries: {
        Row: {
          bonus: string | null
          category: Database["public"]["Enums"]["discovery_category"]
          description: string | null
          discovered_at: string
          discovered_x: number | null
          discovered_y: number | null
          discovery_id: string
          id: string
          name: string
          player_username: string
        }
        Insert: {
          bonus?: string | null
          category: Database["public"]["Enums"]["discovery_category"]
          description?: string | null
          discovered_at?: string
          discovered_x?: number | null
          discovered_y?: number | null
          discovery_id: string
          id?: string
          name: string
          player_username: string
        }
        Update: {
          bonus?: string | null
          category?: Database["public"]["Enums"]["discovery_category"]
          description?: string | null
          discovered_at?: string
          discovered_x?: number | null
          discovered_y?: number | null
          discovery_id?: string
          id?: string
          name?: string
          player_username?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_discoveries_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_fast_travel_waypoints: {
        Row: {
          id: string
          name: string
          player_username: string
          set_at: string
          x: number
          y: number
        }
        Insert: {
          id?: string
          name: string
          player_username: string
          set_at?: string
          x: number
          y: number
        }
        Update: {
          id?: string
          name?: string
          player_username?: string
          set_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_fast_travel_waypoints_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_flags: {
        Row: {
          created_at: string
          flagged_by: string
          id: string
          player_username: string
          reason: string
          resolved: boolean
        }
        Insert: {
          created_at?: string
          flagged_by: string
          id?: string
          player_username: string
          reason: string
          resolved?: boolean
        }
        Update: {
          created_at?: string
          flagged_by?: string
          id?: string
          player_username?: string
          reason?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "player_flags_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_inventory: {
        Row: {
          bonus_percent: number
          bonus_value: number | null
          description: string | null
          found_at_x: number | null
          found_at_y: number | null
          found_date: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          name: string
          player_username: string
          quantity: number
          rarity: Database["public"]["Enums"]["item_rarity"]
        }
        Insert: {
          bonus_percent?: number
          bonus_value?: number | null
          description?: string | null
          found_at_x?: number | null
          found_at_y?: number | null
          found_date?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          name: string
          player_username: string
          quantity?: number
          rarity: Database["public"]["Enums"]["item_rarity"]
        }
        Update: {
          bonus_percent?: number
          bonus_value?: number | null
          description?: string | null
          found_at_x?: number | null
          found_at_y?: number | null
          found_date?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          name?: string
          player_username?: string
          quantity?: number
          rarity?: Database["public"]["Enums"]["item_rarity"]
        }
        Relationships: [
          {
            foreignKeyName: "player_inventory_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_level_history: {
        Row: {
          changed_at: string | null
          id: string
          level: number
          username: string
        }
        Insert: {
          changed_at?: string | null
          id?: string
          level: number
          username: string
        }
        Update: {
          changed_at?: string | null
          id?: string
          level?: number
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_level_history_username_fkey"
            columns: ["username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_respec_history: {
        Row: {
          changed_at: string
          from_doctrine: Database["public"]["Enums"]["specialization_doctrine"]
          id: string
          player_username: string
          resources_energy: number
          resources_metal: number
          rp_spent: number
          to_doctrine: Database["public"]["Enums"]["specialization_doctrine"]
        }
        Insert: {
          changed_at?: string
          from_doctrine: Database["public"]["Enums"]["specialization_doctrine"]
          id?: string
          player_username: string
          resources_energy: number
          resources_metal: number
          rp_spent: number
          to_doctrine: Database["public"]["Enums"]["specialization_doctrine"]
        }
        Update: {
          changed_at?: string
          from_doctrine?: Database["public"]["Enums"]["specialization_doctrine"]
          id?: string
          player_username?: string
          resources_energy?: number
          resources_metal?: number
          rp_spent?: number
          to_doctrine?: Database["public"]["Enums"]["specialization_doctrine"]
        }
        Relationships: [
          {
            foreignKeyName: "player_respec_history_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_rp_history: {
        Row: {
          amount: number
          balance: number
          created_at: string
          id: string
          player_username: string
          reason: string
        }
        Insert: {
          amount: number
          balance: number
          created_at?: string
          id?: string
          player_username: string
          reason: string
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string
          id?: string
          player_username?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_rp_history_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_sessions: {
        Row: {
          ended_at: string | null
          id: string
          ip_address: string | null
          player_username: string
          session_id: string
          started_at: string
          last_heartbeat: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          player_username: string
          session_id: string
          started_at?: string
          last_heartbeat?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          player_username?: string
          session_id?: string
          started_at?: string
          last_heartbeat?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_sessions_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_shrine_boosts: {
        Row: {
          boost_tier: Database["public"]["Enums"]["shrine_boost_tier"]
          expires_at: string
          id: string
          player_username: string
          yield_bonus: number
        }
        Insert: {
          boost_tier: Database["public"]["Enums"]["shrine_boost_tier"]
          expires_at: string
          id?: string
          player_username: string
          yield_bonus?: number
        }
        Update: {
          boost_tier?: Database["public"]["Enums"]["shrine_boost_tier"]
          expires_at?: string
          id?: string
          player_username?: string
          yield_bonus?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_shrine_boosts_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      player_units: {
        Row: {
          defense: number | null
          id: string
          player_username: string
          produced_at_x: number | null
          produced_at_y: number | null
          produced_date: string | null
          quantity: number
          strength: number | null
          unit_type: Database["public"]["Enums"]["unit_type"]
        }
        Insert: {
          defense?: number | null
          id?: string
          player_username: string
          produced_at_x?: number | null
          produced_at_y?: number | null
          produced_date?: string | null
          quantity?: number
          strength?: number | null
          unit_type: Database["public"]["Enums"]["unit_type"]
        }
        Update: {
          defense?: number | null
          id?: string
          player_username?: string
          produced_at_x?: number | null
          produced_at_y?: number | null
          produced_date?: string | null
          quantity?: number
          strength?: number | null
          unit_type?: Database["public"]["Enums"]["unit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "player_units_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      players: {
        Row: {
          balance_damage_dealt_multiplier: number | null
          balance_damage_taken_multiplier: number | null
          balance_effective_power: number | null
          balance_gathering_multiplier: number | null
          balance_power_multiplier: number | null
          balance_ratio: number | null
          balance_slot_regen_multiplier: number | null
          balance_status: Database["public"]["Enums"]["balance_status"] | null
          ban_reason: string | null
          bank_energy: number
          bank_last_deposit: string | null
          bank_metal: number
          banned_at: string | null
          banned_by: string | null
          base_greeting: string | null
          base_x: number
          base_y: number
          battle_base_defense_lost: number
          battle_base_defense_total: number
          battle_base_defense_won: number
          battle_base_initiated: number
          battle_base_lost: number
          battle_base_won: number
          battle_infantry_initiated: number
          battle_infantry_lost: number
          battle_infantry_won: number
          bot_config: Json | null
          clan_id: string | null
          clan_level: number | null
          clan_name: string | null
          clan_role: Database["public"]["Enums"]["clan_role"] | null
          concentration_zones: Json | null
          created_at: string
          current_hp: number
          current_x: number
          current_y: number
          daily_bounties: Json | null
          email: string
          factory_count: number
          flag_cannot_claim_until: string | null
          flag_challenge_cooldown_until: string | null
          flag_flee_cooldown_until: string | null
          flag_flee_count: number
          flag_flee_paid_energy: number
          flag_flee_paid_metal: number
          flag_grace_until: string | null
          flag_permanent_harvest_bonus: number
          flag_session_energy: number
          flag_session_metal: number
          flag_session_started_at: string | null
          flag_times_held: number
          flag_total_time_held: number
          gathering_energy_bonus: number
          gathering_metal_bonus: number
          inventory_capacity: number
          inventory_energy_digger_count: number
          inventory_metal_digger_count: number
          is_admin: boolean
          is_banned: boolean
          is_bot: boolean
          is_special_base: boolean
          is_vip: boolean
          last_bot_scan: string | null
          last_bot_summon: string | null
          last_fast_travel: string | null
          last_flag_attack: string | null
          last_level_up: string | null
          last_login_date: string | null
          last_streak_reward: string | null
          last_xp_award: string | null
          level: number
          login_streak: number
          max_hp: number
          password: string
          pending_referrals: number
          rank: number
          referral_code: string | null
          referral_link: string | null
          referral_milestones: number[]
          referral_milestones_reached: number[]
          referral_rewards_energy: number
          referral_rewards_metal: number
          referral_rewards_rp: number
          referral_rewards_vip_days: number
          referral_rewards_xp: number
          referral_validated: boolean
          referral_validated_at: string | null
          referred_by: string | null
          referred_by_username: string | null
          research_points: number
          resources_energy: number
          resources_metal: number
          signup_ip: string | null
          spec_doctrine: Database["public"]["Enums"]["specialization_doctrine"]
          spec_last_respec_at: string | null
          spec_mastery_level: number
          spec_mastery_xp: number
          spec_selected_at: string | null
          spec_total_battles_won: number
          spec_total_units_built: number
          stat_battles_won: number
          stat_caves_explored: number
          stat_shrine_trade_count: number
          stat_total_resources_banked: number
          stat_total_resources_gathered: number
          stat_total_units_built: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          total_defense: number
          total_referrals: number
          total_strength: number
          unlocked_techs: string[]
          unlocked_tiers: Database["public"]["Enums"]["unit_tier"][]
          username: string
          vip_expiration: string | null
          vip_last_updated: string | null
          vip_tier: Database["public"]["Enums"]["vip_tier"] | null
          xp: number
        }
        Insert: {
          balance_damage_dealt_multiplier?: number | null
          balance_damage_taken_multiplier?: number | null
          balance_effective_power?: number | null
          balance_gathering_multiplier?: number | null
          balance_power_multiplier?: number | null
          balance_ratio?: number | null
          balance_slot_regen_multiplier?: number | null
          balance_status?: Database["public"]["Enums"]["balance_status"] | null
          ban_reason?: string | null
          bank_energy?: number
          bank_last_deposit?: string | null
          bank_metal?: number
          banned_at?: string | null
          banned_by?: string | null
          base_greeting?: string | null
          base_x?: number
          base_y?: number
          battle_base_defense_lost?: number
          battle_base_defense_total?: number
          battle_base_defense_won?: number
          battle_base_initiated?: number
          battle_base_lost?: number
          battle_base_won?: number
          battle_infantry_initiated?: number
          battle_infantry_lost?: number
          battle_infantry_won?: number
          bot_config?: Json | null
          clan_id?: string | null
          clan_level?: number | null
          clan_name?: string | null
          clan_role?: Database["public"]["Enums"]["clan_role"] | null
          concentration_zones?: Json | null
          created_at?: string
          current_hp?: number
          current_x?: number
          current_y?: number
          daily_bounties?: Json | null
          email: string
          factory_count?: number
          flag_cannot_claim_until?: string | null
          flag_challenge_cooldown_until?: string | null
          flag_flee_cooldown_until?: string | null
          flag_flee_count?: number
          flag_flee_paid_energy?: number
          flag_flee_paid_metal?: number
          flag_grace_until?: string | null
          flag_permanent_harvest_bonus?: number
          flag_session_energy?: number
          flag_session_metal?: number
          flag_session_started_at?: string | null
          flag_times_held?: number
          flag_total_time_held?: number
          gathering_energy_bonus?: number
          gathering_metal_bonus?: number
          inventory_capacity?: number
          inventory_energy_digger_count?: number
          inventory_metal_digger_count?: number
          is_admin?: boolean
          is_banned?: boolean
          is_bot?: boolean
          is_special_base?: boolean
          is_vip?: boolean
          last_bot_scan?: string | null
          last_bot_summon?: string | null
          last_fast_travel?: string | null
          last_flag_attack?: string | null
          last_level_up?: string | null
          last_login_date?: string | null
          last_streak_reward?: string | null
          last_xp_award?: string | null
          level?: number
          login_streak?: number
          max_hp?: number
          password: string
          pending_referrals?: number
          rank?: number
          referral_code?: string | null
          referral_link?: string | null
          referral_milestones?: number[]
          referral_milestones_reached?: number[]
          referral_rewards_energy?: number
          referral_rewards_metal?: number
          referral_rewards_rp?: number
          referral_rewards_vip_days?: number
          referral_rewards_xp?: number
          referral_validated?: boolean
          referral_validated_at?: string | null
          referred_by?: string | null
          referred_by_username?: string | null
          research_points?: number
          resources_energy?: number
          resources_metal?: number
          signup_ip?: string | null
          spec_doctrine?: Database["public"]["Enums"]["specialization_doctrine"]
          spec_last_respec_at?: string | null
          spec_mastery_level?: number
          spec_mastery_xp?: number
          spec_selected_at?: string | null
          spec_total_battles_won?: number
          spec_total_units_built?: number
          stat_battles_won?: number
          stat_caves_explored?: number
          stat_shrine_trade_count?: number
          stat_total_resources_banked?: number
          stat_total_resources_gathered?: number
          stat_total_units_built?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_defense?: number
          total_referrals?: number
          total_strength?: number
          unlocked_techs?: string[]
          unlocked_tiers?: Database["public"]["Enums"]["unit_tier"][]
          username: string
          vip_expiration?: string | null
          vip_last_updated?: string | null
          vip_tier?: Database["public"]["Enums"]["vip_tier"] | null
          xp?: number
        }
        Update: {
          balance_damage_dealt_multiplier?: number | null
          balance_damage_taken_multiplier?: number | null
          balance_effective_power?: number | null
          balance_gathering_multiplier?: number | null
          balance_power_multiplier?: number | null
          balance_ratio?: number | null
          balance_slot_regen_multiplier?: number | null
          balance_status?: Database["public"]["Enums"]["balance_status"] | null
          ban_reason?: string | null
          bank_energy?: number
          bank_last_deposit?: string | null
          bank_metal?: number
          banned_at?: string | null
          banned_by?: string | null
          base_greeting?: string | null
          base_x?: number
          base_y?: number
          battle_base_defense_lost?: number
          battle_base_defense_total?: number
          battle_base_defense_won?: number
          battle_base_initiated?: number
          battle_base_lost?: number
          battle_base_won?: number
          battle_infantry_initiated?: number
          battle_infantry_lost?: number
          battle_infantry_won?: number
          bot_config?: Json | null
          clan_id?: string | null
          clan_level?: number | null
          clan_name?: string | null
          clan_role?: Database["public"]["Enums"]["clan_role"] | null
          concentration_zones?: Json | null
          created_at?: string
          current_hp?: number
          current_x?: number
          current_y?: number
          daily_bounties?: Json | null
          email?: string
          factory_count?: number
          flag_cannot_claim_until?: string | null
          flag_challenge_cooldown_until?: string | null
          flag_flee_cooldown_until?: string | null
          flag_flee_count?: number
          flag_flee_paid_energy?: number
          flag_flee_paid_metal?: number
          flag_grace_until?: string | null
          flag_permanent_harvest_bonus?: number
          flag_session_energy?: number
          flag_session_metal?: number
          flag_session_started_at?: string | null
          flag_times_held?: number
          flag_total_time_held?: number
          gathering_energy_bonus?: number
          gathering_metal_bonus?: number
          inventory_capacity?: number
          inventory_energy_digger_count?: number
          inventory_metal_digger_count?: number
          is_admin?: boolean
          is_banned?: boolean
          is_bot?: boolean
          is_special_base?: boolean
          is_vip?: boolean
          last_bot_scan?: string | null
          last_bot_summon?: string | null
          last_fast_travel?: string | null
          last_flag_attack?: string | null
          last_level_up?: string | null
          last_login_date?: string | null
          last_streak_reward?: string | null
          last_xp_award?: string | null
          level?: number
          login_streak?: number
          max_hp?: number
          password?: string
          pending_referrals?: number
          rank?: number
          referral_code?: string | null
          referral_link?: string | null
          referral_milestones?: number[]
          referral_milestones_reached?: number[]
          referral_rewards_energy?: number
          referral_rewards_metal?: number
          referral_rewards_rp?: number
          referral_rewards_vip_days?: number
          referral_rewards_xp?: number
          referral_validated?: boolean
          referral_validated_at?: string | null
          referred_by?: string | null
          referred_by_username?: string | null
          research_points?: number
          resources_energy?: number
          resources_metal?: number
          signup_ip?: string | null
          spec_doctrine?: Database["public"]["Enums"]["specialization_doctrine"]
          spec_last_respec_at?: string | null
          spec_mastery_level?: number
          spec_mastery_xp?: number
          spec_selected_at?: string | null
          spec_total_battles_won?: number
          spec_total_units_built?: number
          stat_battles_won?: number
          stat_caves_explored?: number
          stat_shrine_trade_count?: number
          stat_total_resources_banked?: number
          stat_total_resources_gathered?: number
          stat_total_units_built?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          total_defense?: number
          total_referrals?: number
          total_strength?: number
          unlocked_techs?: string[]
          unlocked_tiers?: Database["public"]["Enums"]["unit_tier"][]
          username?: string
          vip_expiration?: string | null
          vip_last_updated?: string | null
          vip_tier?: Database["public"]["Enums"]["vip_tier"] | null
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          admin_notes: string | null
          created_at: string
          days_active: number
          flag_reason: string | null
          flagged_for_abuse: boolean
          id: string
          last_login: string | null
          login_count: number
          new_player_email: string | null
          new_player_ip: string | null
          new_player_username: string
          referrer_code: string
          referrer_username: string
          reward_energy: number
          reward_metal: number
          reward_rp: number
          reward_vip_days: number
          reward_xp: number
          rewards_claimed: boolean
          signup_date: string
          updated_at: string
          validated: boolean
          validation_date: string | null
          welcome_package_given: boolean
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          days_active?: number
          flag_reason?: string | null
          flagged_for_abuse?: boolean
          id?: string
          last_login?: string | null
          login_count?: number
          new_player_email?: string | null
          new_player_ip?: string | null
          new_player_username: string
          referrer_code: string
          referrer_username: string
          reward_energy?: number
          reward_metal?: number
          reward_rp?: number
          reward_vip_days?: number
          reward_xp?: number
          rewards_claimed?: boolean
          signup_date?: string
          updated_at?: string
          validated?: boolean
          validation_date?: string | null
          welcome_package_given?: boolean
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          days_active?: number
          flag_reason?: string | null
          flagged_for_abuse?: boolean
          id?: string
          last_login?: string | null
          login_count?: number
          new_player_email?: string | null
          new_player_ip?: string | null
          new_player_username?: string
          referrer_code?: string
          referrer_username?: string
          reward_energy?: number
          reward_metal?: number
          reward_rp?: number
          reward_vip_days?: number
          reward_xp?: number
          rewards_claimed?: boolean
          signup_date?: string
          updated_at?: string
          validated?: boolean
          validation_date?: string | null
          welcome_package_given?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referrer_username_fkey"
            columns: ["referrer_username"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      tile_harvest_records: {
        Row: {
          harvested_at: string
          id: string
          player_id: string
          reset_period: string
          tile_x: number
          tile_y: number
        }
        Insert: {
          harvested_at?: string
          id?: string
          player_id: string
          reset_period: string
          tile_x: number
          tile_y: number
        }
        Update: {
          harvested_at?: string
          id?: string
          player_id?: string
          reset_period?: string
          tile_x?: number
          tile_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "tile_harvest_records_tile_x_tile_y_fkey"
            columns: ["tile_x", "tile_y"]
            isOneToOne: false
            referencedRelation: "tiles"
            referencedColumns: ["x", "y"]
          },
        ]
      }
      tiles: {
        Row: {
          bank_type: Database["public"]["Enums"]["bank_type"] | null
          base_greeting: string | null
          base_owner: string | null
          has_flag_bearer: boolean
          has_trail: boolean
          occupied_by_base: boolean
          terrain: Database["public"]["Enums"]["terrain_type"]
          trail_expires_at: string | null
          trail_timestamp: string | null
          x: number
          y: number
        }
        Insert: {
          bank_type?: Database["public"]["Enums"]["bank_type"] | null
          base_greeting?: string | null
          base_owner?: string | null
          has_flag_bearer?: boolean
          has_trail?: boolean
          occupied_by_base?: boolean
          terrain: Database["public"]["Enums"]["terrain_type"]
          trail_expires_at?: string | null
          trail_timestamp?: string | null
          x: number
          y: number
        }
        Update: {
          bank_type?: Database["public"]["Enums"]["bank_type"] | null
          base_greeting?: string | null
          base_owner?: string | null
          has_flag_bearer?: boolean
          has_trail?: boolean
          occupied_by_base?: boolean
          terrain?: Database["public"]["Enums"]["terrain_type"]
          trail_expires_at?: string | null
          trail_timestamp?: string | null
          x?: number
          y?: number
        }
        Relationships: []
      }
      tutorial_action_tracking: {
        Row: {
          current_count: number
          id: string
          last_updated: string
          player_username: string
          step_id: string
          target_count: number | null
        }
        Insert: {
          current_count?: number
          id?: string
          last_updated?: string
          player_username: string
          step_id: string
          target_count?: number | null
        }
        Update: {
          current_count?: number
          id?: string
          last_updated?: string
          player_username?: string
          step_id?: string
          target_count?: number | null
        }
        Relationships: []
      }
      tutorial_analytics: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          player_username: string
          quest_id: string | null
          skip_reason: string | null
          step_id: string | null
          time_spent: number | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          player_username: string
          quest_id?: string | null
          skip_reason?: string | null
          step_id?: string | null
          time_spent?: number | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          player_username?: string
          quest_id?: string | null
          skip_reason?: string | null
          step_id?: string | null
          time_spent?: number | null
        }
        Relationships: []
      }
      tutorial_progress: {
        Row: {
          claimed_rewards: string[]
          completed_at: string | null
          completed_quests: string[]
          completed_steps: string[]
          current_quest_id: string | null
          current_step_index: number
          current_step_started_at: string | null
          declined_at: string | null
          id: string
          last_updated: string
          player_username: string
          skipped_quests: string[]
          started_at: string
          total_steps_completed: number
          total_time_spent: number
          tutorial_complete: boolean
          tutorial_declined: boolean
          tutorial_skipped: boolean
        }
        Insert: {
          claimed_rewards?: string[]
          completed_at?: string | null
          completed_quests?: string[]
          completed_steps?: string[]
          current_quest_id?: string | null
          current_step_index?: number
          current_step_started_at?: string | null
          declined_at?: string | null
          id?: string
          last_updated?: string
          player_username: string
          skipped_quests?: string[]
          started_at?: string
          total_steps_completed?: number
          total_time_spent?: number
          tutorial_complete?: boolean
          tutorial_declined?: boolean
          tutorial_skipped?: boolean
        }
        Update: {
          claimed_rewards?: string[]
          completed_at?: string | null
          completed_quests?: string[]
          completed_steps?: string[]
          current_quest_id?: string | null
          current_step_index?: number
          current_step_started_at?: string | null
          declined_at?: string | null
          id?: string
          last_updated?: string
          player_username?: string
          skipped_quests?: string[]
          started_at?: string
          total_steps_completed?: number
          total_time_spent?: number
          tutorial_complete?: boolean
          tutorial_declined?: boolean
          tutorial_skipped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_progress_player_username_fkey"
            columns: ["player_username"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      unit_definitions: {
        Row: {
          defense: number
          energy_cost: number
          level_required: number
          metal_cost: number
          name: string
          rp_required: number
          slot_cost: number
          strength: number
          tier: Database["public"]["Enums"]["unit_tier"]
          unit_type: Database["public"]["Enums"]["unit_type"]
        }
        Insert: {
          defense: number
          energy_cost: number
          level_required: number
          metal_cost: number
          name: string
          rp_required: number
          slot_cost: number
          strength: number
          tier: Database["public"]["Enums"]["unit_tier"]
          unit_type: Database["public"]["Enums"]["unit_type"]
        }
        Update: {
          defense?: number
          energy_cost?: number
          level_required?: number
          metal_cost?: number
          name?: string
          rp_required?: number
          slot_cost?: number
          strength?: number
          tier?: Database["public"]["Enums"]["unit_tier"]
          unit_type?: Database["public"]["Enums"]["unit_type"]
        }
        Relationships: []
      }
      wmd_clan_defense_grid: {
        Row: {
          clan_id: string
          created_at: string
          grid_radius: number
          id: string
          pooled_batteries: Json
          updated_at: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          grid_radius?: number
          id?: string
          pooled_batteries?: Json
          updated_at?: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          grid_radius?: number
          id?: string
          pooled_batteries?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wmd_clan_defense_grid_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: true
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      wmd_clan_votes: {
        Row: {
          clan_id: string
          closed_at: string | null
          created_at: string
          description: string | null
          expires_at: string
          id: string
          proposed_by: string
          result: Json | null
          status: Database["public"]["Enums"]["wmd_vote_status"]
          title: string
          total_eligible: number
          vote_id: string
          vote_type: Database["public"]["Enums"]["wmd_vote_type"]
          votes_abstain: number
          votes_against: number
          votes_for: number
        }
        Insert: {
          clan_id: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          expires_at: string
          id?: string
          proposed_by: string
          result?: Json | null
          status?: Database["public"]["Enums"]["wmd_vote_status"]
          title: string
          total_eligible?: number
          vote_id: string
          vote_type: Database["public"]["Enums"]["wmd_vote_type"]
          votes_abstain?: number
          votes_against?: number
          votes_for?: number
        }
        Update: {
          clan_id?: string
          closed_at?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          proposed_by?: string
          result?: Json | null
          status?: Database["public"]["Enums"]["wmd_vote_status"]
          title?: string
          total_eligible?: number
          vote_id?: string
          vote_type?: Database["public"]["Enums"]["wmd_vote_type"]
          votes_abstain?: number
          votes_against?: number
          votes_for?: number
        }
        Relationships: [
          {
            foreignKeyName: "wmd_clan_votes_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      wmd_defense_batteries: {
        Row: {
          battery_id: string
          created_at: string
          id: string
          interception_range: number
          name: string | null
          owner_id: string
          owner_username: string
          position_x: number
          position_y: number
          recharges_at: string | null
          status: string
          tier: number
        }
        Insert: {
          battery_id: string
          created_at?: string
          id?: string
          interception_range?: number
          name?: string | null
          owner_id: string
          owner_username: string
          position_x: number
          position_y: number
          recharges_at?: string | null
          status?: string
          tier?: number
        }
        Update: {
          battery_id?: string
          created_at?: string
          id?: string
          interception_range?: number
          name?: string | null
          owner_id?: string
          owner_username?: string
          position_x?: number
          position_y?: number
          recharges_at?: string | null
          status?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "wmd_defense_batteries_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_interception_attempts: {
        Row: {
          attempted_at: string
          battery_id: string | null
          defender_id: string
          defender_username: string
          id: string
          launch_id: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          battery_id?: string | null
          defender_id: string
          defender_username: string
          id?: string
          launch_id: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          battery_id?: string | null
          defender_id?: string
          defender_username?: string
          id?: string
          launch_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "wmd_interception_attempts_defender_id_fkey"
            columns: ["defender_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_launch_history: {
        Row: {
          damage_dealt: number
          id: string
          intercepted_by: string | null
          launch_id: string
          launched_at: string
          missile_id: string
          owner_id: string
          owner_username: string
          result: Json | null
          status: Database["public"]["Enums"]["wmd_launch_status"]
          target_x: number
          target_y: number
        }
        Insert: {
          damage_dealt?: number
          id?: string
          intercepted_by?: string | null
          launch_id: string
          launched_at?: string
          missile_id: string
          owner_id: string
          owner_username: string
          result?: Json | null
          status: Database["public"]["Enums"]["wmd_launch_status"]
          target_x: number
          target_y: number
        }
        Update: {
          damage_dealt?: number
          id?: string
          intercepted_by?: string | null
          launch_id?: string
          launched_at?: string
          missile_id?: string
          owner_id?: string
          owner_username?: string
          result?: Json | null
          status?: Database["public"]["Enums"]["wmd_launch_status"]
          target_x?: number
          target_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "wmd_launch_history_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_missile_components: {
        Row: {
          component_type: string
          created_at: string
          id: string
          player_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          component_type: string
          created_at?: string
          id?: string
          player_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          component_type?: string
          created_at?: string
          id?: string
          player_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wmd_missile_components_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_missile_warheads: {
        Row: {
          created_at: string
          damage: number
          id: string
          missile_id: string
          warhead_type: Database["public"]["Enums"]["wmd_warhead_type"]
        }
        Insert: {
          created_at?: string
          damage: number
          id?: string
          missile_id: string
          warhead_type: Database["public"]["Enums"]["wmd_warhead_type"]
        }
        Update: {
          created_at?: string
          damage?: number
          id?: string
          missile_id?: string
          warhead_type?: Database["public"]["Enums"]["wmd_warhead_type"]
        }
        Relationships: [
          {
            foreignKeyName: "wmd_missile_warheads_missile_id_fkey"
            columns: ["missile_id"]
            isOneToOne: false
            referencedRelation: "wmd_missiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wmd_missiles: {
        Row: {
          assembled_at: string | null
          assembly_started: string | null
          created_at: string
          damage_radius: number
          eta_seconds: number | null
          id: string
          launched_at: string | null
          missile_id: string
          name: string | null
          owner_id: string
          owner_username: string
          status: Database["public"]["Enums"]["wmd_launch_status"]
          target_x: number | null
          target_y: number | null
        }
        Insert: {
          assembled_at?: string | null
          assembly_started?: string | null
          created_at?: string
          damage_radius?: number
          eta_seconds?: number | null
          id?: string
          launched_at?: string | null
          missile_id: string
          name?: string | null
          owner_id: string
          owner_username: string
          status?: Database["public"]["Enums"]["wmd_launch_status"]
          target_x?: number | null
          target_y?: number | null
        }
        Update: {
          assembled_at?: string | null
          assembly_started?: string | null
          created_at?: string
          damage_radius?: number
          eta_seconds?: number | null
          id?: string
          launched_at?: string | null
          missile_id?: string
          name?: string | null
          owner_id?: string
          owner_username?: string
          status?: Database["public"]["Enums"]["wmd_launch_status"]
          target_x?: number | null
          target_y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wmd_missiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          message: string
          notification_type: Database["public"]["Enums"]["wmd_notification_type"]
          player_id: string
          title: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message: string
          notification_type: Database["public"]["Enums"]["wmd_notification_type"]
          player_id: string
          title: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: Database["public"]["Enums"]["wmd_notification_type"]
          player_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "wmd_notifications_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_player_research: {
        Row: {
          available_techs: string[]
          clan_id: string | null
          completed_techs: string[]
          created_at: string
          id: string
          locked_techs: string[]
          player_id: string
          player_username: string
          total_rp_spent: number
          updated_at: string
        }
        Insert: {
          available_techs?: string[]
          clan_id?: string | null
          completed_techs?: string[]
          created_at?: string
          id?: string
          locked_techs?: string[]
          player_id: string
          player_username: string
          total_rp_spent?: number
          updated_at?: string
        }
        Update: {
          available_techs?: string[]
          clan_id?: string | null
          completed_techs?: string[]
          created_at?: string
          id?: string
          locked_techs?: string[]
          player_id?: string
          player_username?: string
          total_rp_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wmd_player_research_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wmd_player_research_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_sabotage_events: {
        Row: {
          created_at: string
          damage_description: string | null
          detected: boolean
          event_id: string
          id: string
          sabotage_type: string
          saboteur_id: string
          severity: number
          spy_mission_id: string | null
          successful: boolean
          target_player_id: string
        }
        Insert: {
          created_at?: string
          damage_description?: string | null
          detected?: boolean
          event_id: string
          id?: string
          sabotage_type: string
          saboteur_id: string
          severity?: number
          spy_mission_id?: string | null
          successful?: boolean
          target_player_id: string
        }
        Update: {
          created_at?: string
          damage_description?: string | null
          detected?: boolean
          event_id?: string
          id?: string
          sabotage_type?: string
          saboteur_id?: string
          severity?: number
          spy_mission_id?: string | null
          successful?: boolean
          target_player_id?: string
        }
        Relationships: []
      }
      wmd_spies: {
        Row: {
          created_at: string
          experience: number
          id: string
          name: string | null
          owner_id: string
          owner_username: string
          position_x: number
          position_y: number
          spy_id: string
          status: string
        }
        Insert: {
          created_at?: string
          experience?: number
          id?: string
          name?: string | null
          owner_id: string
          owner_username: string
          position_x: number
          position_y: number
          spy_id: string
          status?: string
        }
        Update: {
          created_at?: string
          experience?: number
          id?: string
          name?: string | null
          owner_id?: string
          owner_username?: string
          position_x?: number
          position_y?: number
          spy_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wmd_spies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["username"]
          },
        ]
      }
      wmd_spy_missions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          mission_id: string
          mission_type: string
          owner_id: string
          result: Json | null
          spy_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["wmd_mission_status"]
          target_player_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id: string
          mission_type: string
          owner_id: string
          result?: Json | null
          spy_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["wmd_mission_status"]
          target_player_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_id?: string
          mission_type?: string
          owner_id?: string
          result?: Json | null
          spy_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["wmd_mission_status"]
          target_player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wmd_spy_missions_spy_id_fkey"
            columns: ["spy_id"]
            isOneToOne: false
            referencedRelation: "wmd_spies"
            referencedColumns: ["id"]
          },
        ]
      }
      wmd_vote_ballots: {
        Row: {
          choice: string
          id: string
          vote_id: string
          voted_at: string
          voter_id: string
        }
        Insert: {
          choice: string
          id?: string
          vote_id: string
          voted_at?: string
          voter_id: string
        }
        Update: {
          choice?: string
          id?: string
          vote_id?: string
          voted_at?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wmd_vote_ballots_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "wmd_clan_votes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      achievement_category:
        | "combat"
        | "economic"
        | "exploration"
        | "progression"
      achievement_rarity: "common" | "rare" | "epic" | "legendary"
      alliance_status: "PROPOSED" | "ACTIVE" | "BROKEN" | "EXPIRED"
      alliance_type: "NAP" | "TRADE" | "MILITARY" | "FEDERATION"
      auction_item_type: "unit" | "resource" | "tradeable_item"
      auction_status: "active" | "sold" | "cancelled" | "expired"
      balance_status: "CRITICAL" | "IMBALANCED" | "BALANCED" | "OPTIMAL"
      bank_type: "metal" | "energy" | "exchange"
      bot_movement: "stationary" | "roam" | "teleport"
      bot_reputation: "unknown" | "notorious" | "infamous" | "legendary"
      bot_specialization:
        | "hoarder"
        | "fortress"
        | "raider"
        | "ghost"
        | "balanced"
        | "boss"
      clan_activity_type:
        | "CLAN_CREATED"
        | "MEMBER_JOINED"
        | "MEMBER_LEFT"
        | "MEMBER_KICKED"
        | "MEMBER_PROMOTED"
        | "MEMBER_DEMOTED"
        | "LEADERSHIP_TRANSFERRED"
        | "SETTINGS_CHANGED"
        | "LEVEL_UP"
        | "PERK_ACTIVATED"
        | "PERK_DEACTIVATED"
        | "RESEARCH_UNLOCKED"
        | "RESEARCH_CONTRIBUTED"
        | "TERRITORY_CLAIMED"
        | "TERRITORY_LOST"
        | "TERRITORY_INCOME_COLLECTED"
        | "WAR_DECLARED"
        | "WAR_ENDED"
        | "MONUMENT_CAPTURED"
        | "MONUMENT_LOST"
        | "BANK_DEPOSIT"
        | "BANK_WITHDRAWAL"
        | "TAX_COLLECTED"
        | "TAX_RATE_CHANGED"
        | "BANK_UPGRADED"
        | "FUND_DISTRIBUTION"
        | "ALLIANCE_PROPOSED"
        | "ALLIANCE_RECEIVED"
        | "ALLIANCE_ACCEPTED"
        | "ALLIANCE_FORMED"
        | "ALLIANCE_BROKEN"
        | "CONTRACT_ADDED"
        | "CONTRACT_REMOVED"
      clan_bank_tx_type:
        | "DEPOSIT"
        | "WITHDRAWAL"
        | "TAX_COLLECTION"
        | "RESEARCH_SPENDING"
        | "PERK_ACTIVATION"
        | "BANK_UPGRADE"
      clan_perk_category: "COMBAT" | "ECONOMIC" | "SOCIAL" | "STRATEGIC"
      clan_perk_tier: "BRONZE" | "SILVER" | "GOLD" | "LEGENDARY"
      clan_research_category: "INDUSTRIAL" | "MILITARY" | "ECONOMIC" | "SOCIAL"
      clan_role:
        | "LEADER"
        | "CO_LEADER"
        | "OFFICER"
        | "ELITE"
        | "MEMBER"
        | "RECRUIT"
      clan_war_status: "DECLARED" | "ACTIVE" | "ENDED" | "TRUCE"
      contract_type:
        | "RESOURCE_SHARING"
        | "DEFENSE_PACT"
        | "WAR_SUPPORT"
        | "JOINT_RESEARCH"
      discovery_category: "industrial" | "combat" | "strategic"
      distribution_method:
        | "EQUAL_SPLIT"
        | "PERCENTAGE"
        | "MERIT"
        | "DIRECT_GRANT"
      item_rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY"
      item_type:
        | "METAL_DIGGER"
        | "ENERGY_DIGGER"
        | "UNIVERSAL_DIGGER"
        | "TRADEABLE_ITEM"
      monument_type:
        | "ANCIENT_FORGE"
        | "WAR_MEMORIAL"
        | "MARKET_PLAZA"
        | "RESEARCH_LAB"
        | "GRAND_TEMPLE"
      movement_direction:
        | "N"
        | "NE"
        | "E"
        | "SE"
        | "S"
        | "SW"
        | "W"
        | "NW"
        | "REFRESH"
      resource_type: "metal" | "energy"
      shrine_boost_tier: "spade" | "heart" | "diamond" | "club"
      specialization_doctrine: "none" | "offensive" | "defensive" | "tactical"
      terrain_type:
        | "Metal"
        | "Energy"
        | "Cave"
        | "Forest"
        | "Factory"
        | "Wasteland"
        | "Bank"
        | "Shrine"
        | "AuctionHouse"
      transaction_status: "pending" | "completed" | "failed" | "refunded"
      tutorial_quest_category:
        | "MOVEMENT"
        | "COMBAT"
        | "ECONOMY"
        | "SOCIAL"
        | "PROGRESSION"
        | "UI_NAVIGATION"
        | "ENDGAME"
      unit_tier: "1" | "2" | "3" | "4" | "5"
      unit_type:
        | "T1_RIFLEMAN"
        | "T1_SCOUT"
        | "T1_GRENADIER"
        | "T1_SNIPER"
        | "T1_BUNKER"
        | "T1_BARRIER"
        | "T1_TURRET"
        | "T1_SHIELD"
        | "T2_COMMANDO"
        | "T2_RANGER"
        | "T2_ASSASSIN"
        | "T2_DEMOLISHER"
        | "T2_FORTRESS"
        | "T2_BARRICADE"
        | "T2_CANNON"
        | "T2_SENTINEL"
        | "T3_STRIKER"
        | "T3_RAIDER"
        | "T3_ENFORCER"
        | "T3_WARLORD"
        | "T3_CITADEL"
        | "T3_BULWARK"
        | "T3_ARTILLERY"
        | "T3_GUARDIAN"
        | "T4_TITAN"
        | "T4_JUGGERNAUT"
        | "T4_DESTROYER"
        | "T4_ANNIHILATOR"
        | "T4_STRONGHOLD"
        | "T4_RAMPART"
        | "T4_DREADNOUGHT"
        | "T4_COLOSSUS"
        | "T5_OVERLORD"
        | "T5_CONQUEROR"
        | "T5_DEVASTATOR"
        | "T5_APOCALYPSE"
        | "T5_BASTION"
        | "T5_MONOLITH"
        | "T5_LEVIATHAN"
        | "T5_IMMORTAL"
        | "SPEC_OFF_VANGUARD"
        | "SPEC_OFF_BERSERKER"
        | "SPEC_OFF_EXECUTIONER"
        | "SPEC_OFF_ANNIHILATOR"
        | "SPEC_OFF_WARMONGER"
        | "SPEC_DEF_GUARDIAN"
        | "SPEC_DEF_FORTRESS"
        | "SPEC_DEF_CITADEL"
        | "SPEC_DEF_BULWARK"
        | "SPEC_DEF_INVINCIBLE"
        | "SPEC_TAC_STRIKER"
        | "SPEC_TAC_VANGUARD"
        | "SPEC_TAC_ELITE"
        | "SPEC_TAC_COMMANDER"
        | "SPEC_TAC_SUPREME"
        | "PRESTIGE_TITAN"
        | "PRESTIGE_FABRICATOR"
        | "PRESTIGE_OVERLORD"
        | "PRESTIGE_HARVESTER"
        | "PRESTIGE_VAULT_KEEPER"
        | "PRESTIGE_MYSTIC"
        | "PRESTIGE_ANCIENT_SENTINEL"
        | "PRESTIGE_SPELUNKER"
        | "PRESTIGE_CHAMPION"
        | "PRESTIGE_APEX_PREDATOR"
      vip_tier: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "YEARLY"
      wmd_launch_status:
        | "preparing"
        | "in_flight"
        | "impacted"
        | "intercepted"
        | "failed"
      wmd_mission_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "failed"
        | "aborted"
      wmd_notification_type:
        | "missile_launched"
        | "missile_incoming"
        | "missile_impact"
        | "missile_intercepted"
        | "spy_dispatched"
        | "spy_detected"
        | "spy_captured"
        | "spy_mission_complete"
        | "sabotage_detected"
        | "sabotage_repelled"
        | "sabotage_successful"
        | "defense_activated"
        | "defense_upgraded"
        | "defense_breached"
        | "research_complete"
        | "tech_unlocked"
        | "vote_started"
        | "vote_complete"
        | "vote_tie"
      wmd_vote_status: "active" | "passed" | "failed" | "tied" | "expired"
      wmd_vote_type:
        | "launch_authorization"
        | "research_priority"
        | "defense_allocation"
        | "spy_mission"
        | "retaliation"
      wmd_warhead_type:
        | "high_explosive"
        | "chemical"
        | "biological"
        | "nuclear"
        | "emp"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      achievement_category: [
        "combat",
        "economic",
        "exploration",
        "progression",
      ],
      achievement_rarity: ["common", "rare", "epic", "legendary"],
      alliance_status: ["PROPOSED", "ACTIVE", "BROKEN", "EXPIRED"],
      alliance_type: ["NAP", "TRADE", "MILITARY", "FEDERATION"],
      auction_item_type: ["unit", "resource", "tradeable_item"],
      auction_status: ["active", "sold", "cancelled", "expired"],
      balance_status: ["CRITICAL", "IMBALANCED", "BALANCED", "OPTIMAL"],
      bank_type: ["metal", "energy", "exchange"],
      bot_movement: ["stationary", "roam", "teleport"],
      bot_reputation: ["unknown", "notorious", "infamous", "legendary"],
      bot_specialization: [
        "hoarder",
        "fortress",
        "raider",
        "ghost",
        "balanced",
        "boss",
      ],
      clan_activity_type: [
        "CLAN_CREATED",
        "MEMBER_JOINED",
        "MEMBER_LEFT",
        "MEMBER_KICKED",
        "MEMBER_PROMOTED",
        "MEMBER_DEMOTED",
        "LEADERSHIP_TRANSFERRED",
        "SETTINGS_CHANGED",
        "LEVEL_UP",
        "PERK_ACTIVATED",
        "PERK_DEACTIVATED",
        "RESEARCH_UNLOCKED",
        "RESEARCH_CONTRIBUTED",
        "TERRITORY_CLAIMED",
        "TERRITORY_LOST",
        "TERRITORY_INCOME_COLLECTED",
        "WAR_DECLARED",
        "WAR_ENDED",
        "MONUMENT_CAPTURED",
        "MONUMENT_LOST",
        "BANK_DEPOSIT",
        "BANK_WITHDRAWAL",
        "TAX_COLLECTED",
        "TAX_RATE_CHANGED",
        "BANK_UPGRADED",
        "FUND_DISTRIBUTION",
        "ALLIANCE_PROPOSED",
        "ALLIANCE_RECEIVED",
        "ALLIANCE_ACCEPTED",
        "ALLIANCE_FORMED",
        "ALLIANCE_BROKEN",
        "CONTRACT_ADDED",
        "CONTRACT_REMOVED",
      ],
      clan_bank_tx_type: [
        "DEPOSIT",
        "WITHDRAWAL",
        "TAX_COLLECTION",
        "RESEARCH_SPENDING",
        "PERK_ACTIVATION",
        "BANK_UPGRADE",
      ],
      clan_perk_category: ["COMBAT", "ECONOMIC", "SOCIAL", "STRATEGIC"],
      clan_perk_tier: ["BRONZE", "SILVER", "GOLD", "LEGENDARY"],
      clan_research_category: ["INDUSTRIAL", "MILITARY", "ECONOMIC", "SOCIAL"],
      clan_role: [
        "LEADER",
        "CO_LEADER",
        "OFFICER",
        "ELITE",
        "MEMBER",
        "RECRUIT",
      ],
      clan_war_status: ["DECLARED", "ACTIVE", "ENDED", "TRUCE"],
      contract_type: [
        "RESOURCE_SHARING",
        "DEFENSE_PACT",
        "WAR_SUPPORT",
        "JOINT_RESEARCH",
      ],
      discovery_category: ["industrial", "combat", "strategic"],
      distribution_method: [
        "EQUAL_SPLIT",
        "PERCENTAGE",
        "MERIT",
        "DIRECT_GRANT",
      ],
      item_rarity: ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"],
      item_type: [
        "METAL_DIGGER",
        "ENERGY_DIGGER",
        "UNIVERSAL_DIGGER",
        "TRADEABLE_ITEM",
      ],
      monument_type: [
        "ANCIENT_FORGE",
        "WAR_MEMORIAL",
        "MARKET_PLAZA",
        "RESEARCH_LAB",
        "GRAND_TEMPLE",
      ],
      movement_direction: [
        "N",
        "NE",
        "E",
        "SE",
        "S",
        "SW",
        "W",
        "NW",
        "REFRESH",
      ],
      resource_type: ["metal", "energy"],
      shrine_boost_tier: ["spade", "heart", "diamond", "club"],
      specialization_doctrine: ["none", "offensive", "defensive", "tactical"],
      terrain_type: [
        "Metal",
        "Energy",
        "Cave",
        "Forest",
        "Factory",
        "Wasteland",
        "Bank",
        "Shrine",
        "AuctionHouse",
      ],
      transaction_status: ["pending", "completed", "failed", "refunded"],
      tutorial_quest_category: [
        "MOVEMENT",
        "COMBAT",
        "ECONOMY",
        "SOCIAL",
        "PROGRESSION",
        "UI_NAVIGATION",
        "ENDGAME",
      ],
      unit_tier: ["1", "2", "3", "4", "5"],
      unit_type: [
        "T1_RIFLEMAN",
        "T1_SCOUT",
        "T1_GRENADIER",
        "T1_SNIPER",
        "T1_BUNKER",
        "T1_BARRIER",
        "T1_TURRET",
        "T1_SHIELD",
        "T2_COMMANDO",
        "T2_RANGER",
        "T2_ASSASSIN",
        "T2_DEMOLISHER",
        "T2_FORTRESS",
        "T2_BARRICADE",
        "T2_CANNON",
        "T2_SENTINEL",
        "T3_STRIKER",
        "T3_RAIDER",
        "T3_ENFORCER",
        "T3_WARLORD",
        "T3_CITADEL",
        "T3_BULWARK",
        "T3_ARTILLERY",
        "T3_GUARDIAN",
        "T4_TITAN",
        "T4_JUGGERNAUT",
        "T4_DESTROYER",
        "T4_ANNIHILATOR",
        "T4_STRONGHOLD",
        "T4_RAMPART",
        "T4_DREADNOUGHT",
        "T4_COLOSSUS",
        "T5_OVERLORD",
        "T5_CONQUEROR",
        "T5_DEVASTATOR",
        "T5_APOCALYPSE",
        "T5_BASTION",
        "T5_MONOLITH",
        "T5_LEVIATHAN",
        "T5_IMMORTAL",
        "SPEC_OFF_VANGUARD",
        "SPEC_OFF_BERSERKER",
        "SPEC_OFF_EXECUTIONER",
        "SPEC_OFF_ANNIHILATOR",
        "SPEC_OFF_WARMONGER",
        "SPEC_DEF_GUARDIAN",
        "SPEC_DEF_FORTRESS",
        "SPEC_DEF_CITADEL",
        "SPEC_DEF_BULWARK",
        "SPEC_DEF_INVINCIBLE",
        "SPEC_TAC_STRIKER",
        "SPEC_TAC_VANGUARD",
        "SPEC_TAC_ELITE",
        "SPEC_TAC_COMMANDER",
        "SPEC_TAC_SUPREME",
        "PRESTIGE_TITAN",
        "PRESTIGE_FABRICATOR",
        "PRESTIGE_OVERLORD",
        "PRESTIGE_HARVESTER",
        "PRESTIGE_VAULT_KEEPER",
        "PRESTIGE_MYSTIC",
        "PRESTIGE_ANCIENT_SENTINEL",
        "PRESTIGE_SPELUNKER",
        "PRESTIGE_CHAMPION",
        "PRESTIGE_APEX_PREDATOR",
      ],
      vip_tier: ["WEEKLY", "MONTHLY", "QUARTERLY", "BIANNUAL", "YEARLY"],
      wmd_launch_status: [
        "preparing",
        "in_flight",
        "impacted",
        "intercepted",
        "failed",
      ],
      wmd_mission_status: [
        "pending",
        "in_progress",
        "completed",
        "failed",
        "aborted",
      ],
      wmd_notification_type: [
        "missile_launched",
        "missile_incoming",
        "missile_impact",
        "missile_intercepted",
        "spy_dispatched",
        "spy_detected",
        "spy_captured",
        "spy_mission_complete",
        "sabotage_detected",
        "sabotage_repelled",
        "sabotage_successful",
        "defense_activated",
        "defense_upgraded",
        "defense_breached",
        "research_complete",
        "tech_unlocked",
        "vote_started",
        "vote_complete",
        "vote_tie",
      ],
      wmd_vote_status: ["active", "passed", "failed", "tied", "expired"],
      wmd_vote_type: [
        "launch_authorization",
        "research_priority",
        "defense_allocation",
        "spy_mission",
        "retaliation",
      ],
      wmd_warhead_type: [
        "high_explosive",
        "chemical",
        "biological",
        "nuclear",
        "emp",
      ],
    },
  },
} as const
