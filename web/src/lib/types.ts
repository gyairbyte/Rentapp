export type Property = {
  id: string
  user_id: string
  nickname: string
  street_address: string
  city: string
  state: string
  zip: string
  property_type: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type PropertyInsert = Omit<Property, 'id' | 'created_at' | 'updated_at'>
export type PropertyUpdate = Partial<Omit<Property, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export type Database = {
  public: {
    Tables: {
      properties: {
        Row: Property
        Insert: PropertyInsert
        Update: PropertyUpdate
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
