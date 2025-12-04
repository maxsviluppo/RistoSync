import { createClient } from '@supabase/supabase-js';

// VITE_SUPABASE_URL e VITE_SUPABASE_KEY devono essere impostati nelle variabili d'ambiente (es. su Vercel o file .env)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_KEY || '';

export const SUPER_ADMIN_EMAIL = 'castro.massimo@yahoo.com'; 

// Crea il client solo se le chiavi esistono
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const isSupabaseConfigured = () => {
    return !!supabase;
};

// Funzioni Auth Helper
export const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    localStorage.clear(); // Pulisce anche la cache locale
    window.location.reload();
};