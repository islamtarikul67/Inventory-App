import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate URL
if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  throw new Error(`Invalid supabaseUrl: "${supabaseUrl}". Must be a valid HTTP or HTTPS URL.`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { supabaseUrl, supabaseAnonKey };
