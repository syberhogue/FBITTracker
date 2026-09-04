import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const demoMode = import.meta.env.VITE_DEMO_MODE === 'true' || !url || !key || key.includes('replace-with');

export const supabase = createClient(url || 'http://127.0.0.1:54321', key || 'demo-placeholder', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
