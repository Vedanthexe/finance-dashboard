import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vgqqtmoqjeknojdbirsh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncXF0bW9xamVrbm9qZGJpcnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzY1NTcsImV4cCI6MjA5NTM1MjU1N30.o7s9Mh8uMzAomY6GhJQh24iXGwxziWSv20DBoJYC8es'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
