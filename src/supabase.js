import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vgqqtmoqjeknojdbirsh.supabase.co'
const supabaseAnonKey = 'sb_publishable_EUVRVxKMLkgfaVu6H454ew_SXniGLs7'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
