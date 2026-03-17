import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dafdxgtrbtegvbvbwbfc.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhZmR4Z3RyYnRlZ3ZidmJ3YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzg4MDgsImV4cCI6MjA4OTI1NDgwOH0.q_TqHq9ZahYTOMEB_OT0WASzlf1CmWrc0pgU7eUP-Bo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
