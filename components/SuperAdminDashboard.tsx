import React, { useEffect, useState } from 'react';
import { supabase, signOut } from '../services/supabase';
import { ShieldCheck, Users, Database, LogOut, Activity, RefreshCw, Smartphone, PlayCircle, PauseCircle, AlertTriangle, Copy, Check, User, PlusCircle, Edit2, Save, X, FlaskConical, Terminal, Trash2, Lock, LifeBuoy, Globe, Image as ImageIcon } from 'lucide-react';

interface SuperAdminDashboardProps {
    onEnterApp: () => void;
}

const SUPER_ADMIN_EMAIL = 'castro.massimo@yahoo.com';

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onEnterApp }) => {
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [copiedSQL, setCopiedSQL] = useState(false);
    const [copiedDemo, setCopiedDemo] = useState(false);
    const [copiedRecovery, setCopiedRecovery] = useState(false);
    const [copiedPublic, setCopiedPublic] = useState(false);
    const [copiedImage, setCopiedImage] = useState(false);
    const [currentEmail, setCurrentEmail] = useState<string>('');
    const [showSqlModal, setShowSqlModal] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [showPublicModal, setShowPublicModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    
    // Recovery State
    const [recoveryEmail, setRecoveryEmail] = useState('');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    
    useEffect(() => {
        supabase?.auth.getUser().then(({ data }) => {
            if (data.user?.email) setCurrentEmail(data.user.email);
        });

        fetchProfiles();
        const interval = setInterval(fetchProfiles, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchProfiles = async () => {
        if (!supabase) return;
        setLoading(true);
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (data) setProfiles(data);
        if (error) console.error("Errore recupero profili:", error);
        setLoading(false);
    };

    const toggleStatus = async (id: string, currentStatus: string, email: string) => {
        if (id.startsWith('demo-')) {
            alert("Questa è una riga simulata. Non puoi modificarne lo stato reale.");
            return;
        }

        if (email === SUPER_ADMIN_EMAIL) {
            alert("Non puoi sospendere l'account Super Admin principale.");
            return;
        }

        if (!supabase) return;
        // SE è banned -> diventa active. SE è active -> diventa suspended. SE è suspended -> diventa active.
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        
        const { error } = await supabase.from('profiles').update({ subscription_status: newStatus }).eq('id', id);
        if (!error) fetchProfiles();
        else alert("Errore modifica stato: " + error.message);
    };

    const deleteProfile = async (id: string, name: string, email: string) => {
        // 0. SECURITY CHECK: Block deletion of Super Admin
        if (email === SUPER_ADMIN_EMAIL) {
            alert("OPERAZIONE NEGATA\n\nNon è possibile eliminare l'account Super Admin principale.\nQuesto causerebbe la perdita di accesso alla Dashboard.");
            return;
        }

        // 1. Handle Fake Demo Rows
        if (id.startsWith('demo-')) {
            setProfiles(prev => prev.filter(p => p.id !== id));
            return;
        }

        // 2. Confirm Deletion
        if (!confirm(`⚠️ ATTENZIONE: ELIMINAZIONE RISTORANTE\n\nStai per cancellare definitivamente:\nNome: "${name}"\nEmail: ${email}\n\nCOSA SUCCEDE:\n1. Tutti i dati del menu e ordini verranno PERSI.\n2. L'utente non potrà più accedere all'app (vedrà "Account Rimosso").\n\nSe vuoi solo bloccare l'accesso momentaneamente, usa il tasto 'Pausa'.\n\nSei assolutamente sicuro di voler ELIMINARE?`)) {
            return;
        }

        if (!supabase) return;

        // 3. Delete from DB
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        
        if (!error) {
            fetchProfiles(); // Refresh list
        } else {
            console.error(error);
            alert("ERRORE CANCELLAZIONE: " + error.message + "\n\nAssicurati di aver aggiornato le policy SQL premendo 'Copia SQL' in basso e eseguendolo su Supabase.");
        }
    };

    const startEdit = (profile: any) => {
        if (profile.id.startsWith('demo-')) return;
        setEditingId(profile.id);
        setEditName(profile.restaurant_name || '');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditName('');
    };

    const saveEdit = async () => {
        if (!supabase || !editingId) return;
        const { error } = await supabase.from('profiles').update({ restaurant_name: editName }).eq('id', editingId);
        if (!error) {
            setEditingId(null);
            fetchProfiles();
        } else {
            alert("Errore salvataggio: " + error.message);
        }
    };

    const ensureAdminProfile = async () => {
        if (!supabase) return;
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            alert("Utente non autenticato.");
            setLoading(false);
            return;
        }

        const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
        if (!data) {
            const { error } = await supabase.from('profiles').insert({
                id: user.id,
                email: user.email,
                restaurant_name: 'Super Admin HQ',
                subscription_status: 'active'
            });
            if (error) alert("Errore creazione profilo: " + error.message);
            else {
                alert("Profilo creato!");
                fetchProfiles();
            }
        } else {
            alert("Il tuo profilo esiste già (vedi lista). Usa il tasto Modifica (matita) per cambiare il nome.");
        }
        setLoading(false);
    };

    // --- DEMO FEATURES ---
    const simulateDemoRow = () => {
        const fakeId = `demo-${Date.now()}`;
        const fakeProfile = {
            id: fakeId,
            restaurant_name: 'Ristorante Demo (Simulato)',
            email: 'demo@ristosync.com',
            subscription_status: 'active',
            created_at: new Date().toISOString()
        };
        setProfiles(prev => [fakeProfile, ...prev]);
    };

    const getDemoUserSQL = () => {
        return `-- Crea Utente Demo Reale (Email: demo@ristosync.com / Pass: password123)
-- Richiede che la tabella public.profiles esista già!

create extension if not exists pgcrypto;

insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token)
values (
  'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', 
  '00000000-0000-0000-0000-000000000000', 
  'demo@ristosync.com', 
  crypt('password123', gen_salt('bf')), 
  now(), 
  'authenticated', 
  'authenticated', 
  '{"provider":"email","providers":["email"]}', 
  '{"restaurant_name":"Ristorante Demo"}', 
  now(), 
  now(), 
  '', 
  ''
) on conflict (id) do nothing;

-- Inserimento manuale se il trigger non parte
insert into public.profiles (id, email, restaurant_name, subscription_status)
values (
  'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0', 
  'demo@ristosync.com', 
  'Ristorante Demo', 
  'active'
) on conflict (id) do update 
set restaurant_name = 'Ristorante Demo';`;
    };

    const getRecoverySQL = (email: string) => {
        if (!email) return '-- Inserisci un indirizzo email sopra per generare lo script';
        return `-- Recupera Utente: ${email}
-- Inserisce una riga in profiles se l'utente esiste in auth.users
insert into public.profiles (id, email, restaurant_name, subscription_status)
select id, email, 'Ristorante Ripristinato', 'active'
from auth.users
where email = '${email}'
on conflict (id) do update 
set subscription_status = 'active';`;
    };

    const getPublicAccessSQL = () => {
        return `-- PERMETTI LETTURA PUBBLICA DEL MENU (Per Menu Digitale)

-- 1. Permetti a chiunque di LEGGERE il nome del ristorante
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone" 
on public.profiles for select 
using (true);

-- 2. Permetti a chiunque di LEGGERE i piatti
drop policy if exists "Public menu items are viewable by everyone" on public.menu_items;
create policy "Public menu items are viewable by everyone" 
on public.menu_items for select 
using (true);`;
    };

    const getImageUpdateSQL = () => {
        return `-- ABILITA FOTO PIATTI NEL DATABASE
-- Aggiunge la colonna 'image' se non esiste per salvare le foto
alter table public.menu_items 
add column if not exists image text;`;
    };
    
    const copySQL = (sql: string, type: 'reset' | 'demo' | 'recovery' | 'public' | 'image') => {
        navigator.clipboard.writeText(sql);
        if (type === 'reset') {
            setCopiedSQL(true);
            setTimeout(() => setCopiedSQL(false), 2000);
        } else if (type === 'demo') {
            setCopiedDemo(true);
            setTimeout(() => setCopiedDemo(false), 2000);
        } else if (type === 'public') {
            setCopiedPublic(true);
            setTimeout(() => setCopiedPublic(false), 2000);
        } else if (type === 'image') {
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2000);
        } else {
            setCopiedRecovery(true);
            setTimeout(() => setCopiedRecovery(false), 2000);
        }
    };

    const resetSQL = `-- SCRIPT CONFIGURAZIONE DATABASE
-- Eseguilo 1 volta sola per creare le tabelle.

-- 1. Crea la tabella dei Profili Ristoranti
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  restaurant_name text,
  subscription_status text default 'active',
  google_api_key text,
  settings jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Crea la tabella del Menu
create table if not exists public.menu_items (
  id text primary key,
  user_id uuid references auth.users(id),
  name text,
  price numeric,
  category text,
  description text,
  allergens jsonb,
  image text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Crea la tabella degli Ordini
create table if not exists public.orders (
  id text primary key,
  user_id uuid references auth.users(id),
  table_number text,
  status text,
  items jsonb,
  timestamp bigint,
  waiter_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Abilita la sicurezza (RLS)
alter table public.profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;

-- 5. ASSEGNA I PERMESSI (Fondamentale)
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all functions in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;

-- 6. Crea le Policy di accesso
drop policy if exists "Public profiles view" on public.profiles;
create policy "Public profiles view" on public.profiles for select using (true);

drop policy if exists "User update own profile" on public.profiles;
create policy "User update own profile" on public.profiles for update using (auth.uid() = id);

drop policy if exists "User insert own profile" on public.profiles;
create policy "User insert own profile" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Public menu view" on public.menu_items;
create policy "Public menu view" on public.menu_items for select using (true);

drop policy if exists "User manage menu" on public.menu_items;
create policy "User manage menu" on public.menu_items for all using (auth.uid() = user_id);

drop policy if exists "User manage orders" on public.orders;
create policy "User manage orders" on public.orders for all using (auth.uid() = user_id);

-- 7. Inserisci il profilo Demo manualmente (se l'utente auth esiste già)
insert into public.profiles (id, email, restaurant_name, subscription_status)
select id, email, 'Ristorante Demo', 'active'
from auth.users where email = 'demo@ristosync.com'
on conflict (id) do nothing;
`;

    const isEmailCorrect = currentEmail.toLowerCase() === SUPER_ADMIN_EMAIL;

    return (
        <div className="min-h-screen bg-slate-900 text-white font-sans p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-red-600 rounded-2xl shadow-lg shadow-red-600/20">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black">SUPER ADMIN</h1>
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <User size={14}/> 
                                {currentEmail ? (
                                    <span>Loggato come: <strong className={isEmailCorrect ? "text-green-400" : "text-red-400"}>{currentEmail}</strong></span>
                                ) : 'Verifica utente...'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex gap-3">
                        <button onClick={onEnterApp} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-600/20 transition-all">
                            <Smartphone size={18} /> Entra come Utente
                        </button>
                        <button onClick={signOut} className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-800 px-6 py-3 rounded-xl font-bold border border-slate-700">
                            <LogOut size={18} /> Logout
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400"><Users /></div>
                            <span className="text-3xl font-bold">{profiles.length}</span>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Ristoranti Registrati</h3>
                    </div>
                    
                    {/* DEMO CARD */}
                    <div className="bg-slate-800 p-6 rounded-2xl border border-orange-500/30 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><FlaskConical size={80} /></div>
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400"><FlaskConical /></div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setShowImageModal(true)}
                                    className="text-xs bg-indigo-600/20 hover:bg-indigo-600 hover:text-white text-indigo-400 w-8 h-8 rounded-lg flex items-center justify-center transition-colors border border-indigo-500/30"
                                    title="Abilita Foto Database"
                                >
                                    <ImageIcon size={16}/>
                                </button>
                                <button 
                                    onClick={() => setShowPublicModal(true)}
                                    className="text-xs bg-pink-600/20 hover:bg-pink-600 hover:text-white text-pink-400 w-8 h-8 rounded-lg flex items-center justify-center transition-colors border border-pink-500/30"
                                    title="Abilita Menu Pubblico"
                                >
                                    <Globe size={16}/>
                                </button>
                                <button 
                                    onClick={() => setShowRecoveryModal(true)}
                                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                    title="SOS Recovery Utente"
                                >
                                    <LifeBuoy size={16} className="text-blue-400"/>
                                </button>
                                <button 
                                    onClick={() => setShowSqlModal(true)}
                                    className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
                                >
                                    <Terminal size={12}/> CREA DEMO
                                </button>
                            </div>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-2">Area Demo & Utility</h3>
                        <button onClick={simulateDemoRow} className="text-orange-400 text-xs hover:underline text-left">
                            + Aggiungi riga simulata alla tabella
                        </button>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-green-500/10 rounded-xl text-green-400"><Database /></div>
                            <span className="text-xs font-mono bg-green-900/30 text-green-400 px-2 py-1 rounded">ONLINE</span>
                        </div>
                        <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Stato Database</h3>
                    </div>
                </div>

                <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                         <h2 className="font-bold text-xl">Gestione Tenants</h2>
                         <button onClick={fetchProfiles} className="flex items-center gap-2 text-sm font-bold bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-slate-300 transition-colors">
                             <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Aggiorna
                         </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="p-6">Nome Ristorante</th>
                                    <th className="p-6">Email Admin</th>
                                    <th className="p-6">Stato</th>
                                    <th className="p-6 text-right">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {profiles.map(p => {
                                    const isFake = p.id.toString().startsWith('demo-');
                                    const isSuperAdminProfile = p.email === SUPER_ADMIN_EMAIL;
                                    const isBanned = p.subscription_status === 'banned';
                                    
                                    return (
                                        <tr key={p.id} className={`transition-colors ${isFake ? 'bg-orange-500/5 hover:bg-orange-500/10' : 'hover:bg-slate-700/30'} ${isSuperAdminProfile ? 'bg-blue-900/10' : ''}`}>
                                            <td className="p-6">
                                                {editingId === p.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            className="bg-slate-950 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-bold w-full focus:border-blue-500 outline-none"
                                                            autoFocus
                                                        />
                                                        <button onClick={saveEdit} className="p-2 bg-green-600 rounded-lg hover:bg-green-500"><Save size={16}/></button>
                                                        <button onClick={cancelEdit} className="p-2 bg-slate-700 rounded-lg hover:bg-slate-600"><X size={16}/></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3 group">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="font-bold text-white text-lg">{p.restaurant_name || 'N/A'}</div>
                                                                {isFake && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Simulato</span>}
                                                                {isSuperAdminProfile && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">HQ</span>}
                                                                {isBanned && <span className="bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">RICHIESTA SBLOCCO</span>}
                                                            </div>
                                                            <div className="text-xs font-mono text-slate-500 mt-1">{p.id}</div>
                                                        </div>
                                                        {!isFake && (
                                                            <button onClick={() => startEdit(p)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-800 text-blue-400 hover:bg-blue-500 hover:text-white transition-all" title="Modifica Nome">
                                                                <Edit2 size={14}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-6 text-slate-300 font-medium">{p.email}</td>
                                            <td className="p-6">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase 
                                                    ${p.subscription_status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                                                      p.subscription_status === 'banned' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 
                                                      'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                                                    {p.subscription_status}
                                                </span>
                                            </td>
                                            <td className="p-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {!isSuperAdminProfile && (
                                                        <button 
                                                            onClick={() => toggleStatus(p.id, p.subscription_status, p.email)}
                                                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-colors
                                                                ${isFake ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-400' : 
                                                                    (p.subscription_status === 'active' 
                                                                    ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white border border-blue-500/20' 
                                                                    : 'bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-white border border-green-500/20')}
                                                            `}
                                                            title={p.subscription_status === 'active' ? 'Sospendi Account' : 'Attiva Account'}
                                                        >
                                                            {p.subscription_status === 'active' ? <PauseCircle size={14}/> : <PlayCircle size={14}/>}
                                                        </button>
                                                    )}
                                                    
                                                    {isSuperAdminProfile ? (
                                                        <div className="inline-flex items-center justify-center p-2 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed" title="Protetto da cancellazione">
                                                            <Lock size={14} />
                                                        </div>
                                                    ) : (
                                                        <button 
                                                            onClick={() => deleteProfile(p.id, p.restaurant_name, p.email)}
                                                            className="inline-flex items-center justify-center p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 transition-colors"
                                                            title="Elimina Definitivamente"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {profiles.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="p-10 text-center">
                                            <div className="flex flex-col items-center gap-3 text-slate-500 max-w-lg mx-auto">
                                                <AlertTriangle size={40} className="text-orange-500 mb-2"/>
                                                <p className="font-bold text-white text-lg">Nessun Ristorante Trovato</p>
                                                <button 
                                                    onClick={ensureAdminProfile}
                                                    className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-green-600/20 my-4"
                                                >
                                                    <PlusCircle size={20} /> Crea Profilo
                                                </button>
                                                <div className="bg-slate-950 p-4 rounded-xl border border-slate-700 w-full mt-4 relative group text-left">
                                                    <div className="mb-2 text-xs text-slate-400 uppercase font-bold flex items-center gap-2"><Database size={12}/> SQL Configurazione Iniziale:</div>
                                                    <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-20 custom-scroll">
{resetSQL}
                                                    </pre>
                                                    <button onClick={() => copySQL(resetSQL, 'reset')} className="absolute top-2 right-2 p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white flex items-center gap-2 font-bold text-xs">
                                                        {copiedSQL ? <Check size={14} className="text-green-500"/> : <Copy size={14}/>}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* DEMO SQL MODAL */}
            {showSqlModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-orange-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative">
                        <button onClick={() => setShowSqlModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                        
                        <div className="flex items-center gap-3 mb-4 text-orange-400">
                             <div className="p-2 bg-orange-500/10 rounded-lg"><Terminal size={24} /></div>
                             <h2 className="text-xl font-bold text-white">Genera Utente Demo Reale</h2>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4">
                            Per creare un vero "Ristorante Demo" nel database (accessibile con login), esegui questo script nell'<strong>SQL Editor di Supabase</strong>.
                        </p>
                        
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6">
                            <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-64 custom-scroll p-2">
{getDemoUserSQL()}
                            </pre>
                            <button 
                                onClick={() => copySQL(getDemoUserSQL(), 'demo')}
                                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                            >
                                {copiedDemo ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                {copiedDemo ? 'COPIATO!' : 'COPIA SQL'}
                            </button>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowSqlModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* RECOVERY SQL MODAL */}
            {showRecoveryModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-blue-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative">
                        <button onClick={() => setShowRecoveryModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                        
                        <div className="flex items-center gap-3 mb-4 text-blue-400">
                             <div className="p-2 bg-blue-500/10 rounded-lg"><LifeBuoy size={24} /></div>
                             <h2 className="text-xl font-bold text-white">SOS Recovery</h2>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4">
                            Hai eliminato per sbaglio un utente dalla lista, ma esiste ancora in Auth? <br/>
                            Inserisci la sua email qui sotto per generare il codice di ripristino.
                        </p>

                        <input 
                            type="email" 
                            placeholder="Email utente da recuperare (es. castromassimo@gmail.com)"
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white mb-4 focus:border-blue-500 outline-none"
                        />
                        
                        {recoveryEmail && (
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6">
                                <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-40 custom-scroll p-2">
{getRecoverySQL(recoveryEmail)}
                                </pre>
                                <button 
                                    onClick={() => copySQL(getRecoverySQL(recoveryEmail), 'recovery')}
                                    className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                                >
                                    {copiedRecovery ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                    {copiedRecovery ? 'COPIATO!' : 'COPIA SQL'}
                                </button>
                            </div>
                        )}
                        
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowRecoveryModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PUBLIC ACCESS MODAL */}
            {showPublicModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-pink-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative">
                        <button onClick={() => setShowPublicModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                        
                        <div className="flex items-center gap-3 mb-4 text-pink-400">
                             <div className="p-2 bg-pink-500/10 rounded-lg"><Globe size={24} /></div>
                             <h2 className="text-xl font-bold text-white">Abilita Menu Digitale</h2>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4">
                            Per permettere ai clienti di visualizzare il menu tramite QR Code senza fare login, devi eseguire questo comando SQL <strong>una sola volta</strong>.
                        </p>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6">
                            <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-40 custom-scroll p-2">
{getPublicAccessSQL()}
                            </pre>
                            <button 
                                onClick={() => copySQL(getPublicAccessSQL(), 'public')}
                                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                            >
                                {copiedPublic ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                {copiedPublic ? 'COPIATO!' : 'COPIA SQL'}
                            </button>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowPublicModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMAGE ENABLE MODAL */}
            {showImageModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-slide-up relative">
                        <button onClick={() => setShowImageModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                        
                        <div className="flex items-center gap-3 mb-4 text-indigo-400">
                             <div className="p-2 bg-indigo-500/10 rounded-lg"><ImageIcon size={24} /></div>
                             <h2 className="text-xl font-bold text-white">Abilita Foto nel Database</h2>
                        </div>
                        
                        <p className="text-slate-400 text-sm mb-4">
                            Se le immagini dei piatti non appaiono sugli altri dispositivi (es. telefono del cliente), è perché manca la colonna nel database. <br/>
                            Esegui questo SQL per aggiungerla.
                        </p>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 relative group text-left mb-6">
                            <pre className="text-left text-xs text-green-400 font-mono whitespace-pre-wrap overflow-x-auto h-40 custom-scroll p-2">
{getImageUpdateSQL()}
                            </pre>
                            <button 
                                onClick={() => copySQL(getImageUpdateSQL(), 'image')}
                                className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                            >
                                {copiedImage ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                                {copiedImage ? 'COPIATO!' : 'COPIA SQL'}
                            </button>
                        </div>
                        
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowImageModal(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold">Chiudi</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminDashboard;