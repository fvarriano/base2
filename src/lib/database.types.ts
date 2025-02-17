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
      projects: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string | null
        }
      }
    }
  }
} 