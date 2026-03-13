import { createClient } from '@supabase/supabase-js';

// Helper per verificare se l'URL è valido
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch (e) {
    return false;
  }
};

let envUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\s+/g, '');
if (!isValidUrl(envUrl)) {
  envUrl = 'https://ozckxztjsautiylvptmf.supabase.co';
}

let envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').replace(/\s+/g, '');
if (!envKey || envKey === 'YOUR_SUPABASE_ANON_KEY') {
  envKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96Y2t4enRqc2F1dGl5bHZwdG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDcyODIsImV4cCI6MjA4ODc4MzI4Mn0.q6HJgzh7LCCQWeH897azaqfTgwF7gYwaaYufdSq6wPM';
}

export const supabaseUrl = envUrl;
export const supabaseAnonKey = envKey;

// Inizializza il client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
