import { Database } from './database.types'

// These are shortcuts to make our types easier to use
export type Video = Database['public']['Tables']['videos']['Row']
export type Frame = Database['public']['Tables']['frames']['Row'] 