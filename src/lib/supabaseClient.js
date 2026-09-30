import { createClient } from '@supabase/supabase-js'

const env = (typeof import.meta !== 'undefined' && import.meta?.env) 
  ? import.meta.env 
  : (typeof process !== 'undefined' && process?.env ? process.env : {})

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

/**
 * Checks if Supabase has been properly configured with valid non-dummy values.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  typeof supabaseUrl === 'string' &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('placeholder') &&
  typeof supabaseAnonKey === 'string' &&
  !supabaseAnonKey.includes('your-anon-key') &&
  !supabaseAnonKey.includes('placeholder')
)

/**
 * Supabase client instance, or null if not configured.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
  : null

/**
 * Tests live connection to Supabase database.
 * Returns { success: boolean, message: string }
 */
export async function testSupabaseConnection() {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      configured: false,
      message: 'Supabase credentials not configured in .env.local'
    }
  }

  try {
    const { error } = await supabase.from('vouchers').select('id').limit(1)
    if (error) {
      return {
        success: false,
        configured: true,
        message: error.message || 'Error querying Supabase vouchers table'
      }
    }
    return {
      success: true,
      configured: true,
      message: 'Successfully connected to Supabase'
    }
  } catch (err) {
    return {
      success: false,
      configured: true,
      message: err.message || 'Failed to reach Supabase endpoint'
    }
  }
}
