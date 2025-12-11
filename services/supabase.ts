import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'ristosync_supabase_url';
const SUPABASE_KEY_KEY = 'ristosync_supabase_key';

// CREDENZIALI FORNITE DALL'UTENTE PER L'ANTEPRIMA
const PRESET_URL = "https://fksidwjclgqosgctpfti.supabase.co";
const PRESET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrc2lkd2pjbGdxb3NnY3RwZnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3OTMxNTcsImV4cCI6MjA4MDM2OTE1N30.smxTUUy2vMb2ta4YjjMXIJO4i6IBEeR5vAo5egXgqkc";

// 1. Cerca nelle variabili d'ambiente (Standard Vite)
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_KEY;

// Funzione helper per verificare se una stringa è valida e non è un placeholder
const isValid = (val: string | undefined) => val && val.length > 5 && !val.includes('your-project');

// 2. Cerca nel LocalStorage
const localUrl = localStorage.getItem(SUPABASE_URL_KEY);
const localKey = localStorage.getItem(SUPABASE_KEY_KEY);

// 3. Determina le credenziali finali (Priorità: Preset > Local > Env)
// Usiamo PRESET come default forte per risolvere il problema dell'utente nell'anteprima
const supabaseUrl = isValid(envUrl) ? envUrl : (localUrl || PRESET_URL);
const supabaseKey = isValid(envKey) ? envKey : (localKey || PRESET_KEY);

export const SUPER_ADMIN_EMAIL = 'castro.massimo@yahoo.com';

// Crea il client solo se le chiavi esistono
export const supabase = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export const isSupabaseConfigured = () => {
    return !!supabase;
};

// --- CONFIG MANAGEMENT UTILS ---
export const saveSupabaseConfig = (url: string, key: string) => {
    if (!url || !key) return;
    localStorage.setItem(SUPABASE_URL_KEY, url.trim());
    localStorage.setItem(SUPABASE_KEY_KEY, key.trim());
    window.location.reload(); // Ricarica per reinizializzare il client
};

export const resetSupabaseConfig = () => {
    localStorage.removeItem(SUPABASE_URL_KEY);
    localStorage.removeItem(SUPABASE_KEY_KEY);
    window.location.reload();
};

// Funzioni Auth Helper
export const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    localStorage.clear(); // Pulisce anche la cache locale
    window.location.reload();
};