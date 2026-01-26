/**
 * Supabase Database Types
 * 
 * These types match your Prisma schema for real-time subscriptions.
 * Generated manually based on the Prisma schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      Card: {
        Row: {
          id: string
          title: string
          description: string | null
          order: string
          listId: string
          createdAt: Date
          updatedAt: Date
          priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null
          dueDate: Date | null
          labels: string[] | null
          assigneeId: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          order: string
          listId: string
          createdAt?: Date
          updatedAt?: Date
          priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null
          dueDate?: Date | null
          labels?: string[] | null
          assigneeId?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          order?: string
          listId?: string
          createdAt?: Date
          updatedAt?: Date
          priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null
          dueDate?: Date | null
          labels?: string[] | null
          assigneeId?: string | null
        }
      }
      List: {
        Row: {
          id: string
          title: string
          order: string
          boardId: string
          createdAt: Date
          updatedAt: Date
        }
        Insert: {
          id?: string
          title: string
          order: string
          boardId: string
          createdAt?: Date
          updatedAt?: Date
        }
        Update: {
          id?: string
          title?: string
          order?: string
          boardId?: string
          createdAt?: Date
          updatedAt?: Date
        }
      }
      Board: {
        Row: {
          id: string
          title: string
          orgId: string
          imageId: string | null
          imageThumbUrl: string | null
          imageFullUrl: string | null
          imageUserName: string | null
          imageLinkHTML: string | null
          createdAt: Date
          updatedAt: Date
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      Priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    }
  }
}
