import React, { useState } from 'react';
import { supabase, SUPER_ADMIN_EMAIL, saveSupabaseConfig, resetSupabaseConfig } from '../services/supabase';
import { ChefHat, Mail, Lock, ArrowRight, Loader, Eye, EyeOff, AlertTriangle, ArrowLeft, Send, Database, Save, RefreshCw, XCircle } from 'lucide-react';

const AuthScreen: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isRecovery, setIsRecovery] = useState(false);
    
    // Auth State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [restaurantName, setRestaurantName] = useState('');
    
    // Config State
    const [showConfig, setShowConfig] = useState(!supabase);
    const [dbUrl, setDbUrl] = useState('');
    const [dbKey, setDbKey] = useState('');

    // Status State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [confirmationPending, setConfirmationPending] = useState(false);

    const handleConfigSave = (e: React.FormEvent) => {
        e.preventDefault();
        saveSupabaseConfig(dbUrl, dbKey);
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        setConfirmationPending(false);
        
        if (!supabase) {
            setError("Connessione al database non configurata.");
            setShowConfig(true);
            setLoading(false);
            return;
        }

        try {
            if (isRecovery) {
                // PASSWORD RECOVERY FLOW
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin, 
                });
                if (error) throw error;
                setSuccessMsg("Email di recupero inviata! Controlla la tua casella di posta (e lo spam).");
            } else if (isLogin) {
                // LOGIN
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                // REGISTER
                let defaultCost = '49.90';
                try {
                    const { data: adminProfile } = await supabase
                        .from('profiles')
                        .select('settings')
                        .eq('email', SUPER_ADMIN_EMAIL)
                        .single();
                    if (adminProfile?.settings?.globalConfig?.defaultCost) {
                        defaultCost = adminProfile.settings.globalConfig.defaultCost;
                    }
                } catch (e) { console.log("Using fallback cost"); }

                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { restaurant_name: restaurantName } }
                });

                if (signUpError) throw signUpError;
                
                if (data.user && !data.session) {
                    setConfirmationPending(true);
                    setLoading(false);
                    return;
                }
                
                if (data.user) {
                     try {
                         const today = new Date();
                         const trialEndDate = new Date(today);
                         trialEndDate.setDate(today.getDate() + 15);

                         await supabase.from('profiles').insert({
                             id: data.user.id,
                             email: email,
                             restaurant_name: restaurantName,
                             subscription_status: 'active',
                             settings: {
                                 restaurantProfile: {
                                     planType: 'Trial',
                                     subscriptionEndDate: trialEndDate.toISOString(),
                                     subscriptionCost: defaultCost,
                                     name: restaurantName
                                 }
                             }
                         });
                     } catch (e) { console.log("Profile setup check: ", e); }
                     await new Promise(r => setTimeout(r, 1000));
                }
            }
        } catch (err: any) {
            let msg = err.message || "Si è verificato un errore.";
            console.error("Auth Error:", err);
            
            if (msg.includes("security purposes")) msg = "Troppi tentativi. Attendi 60 secondi.";
            else if (msg.includes("Invalid login credentials")) msg = "Email o password non corretti.";
            else if (msg.includes("User already registered")) msg = "Utente già registrato. Accedi.";
            
            setError(msg);
        } finally {
            if (!confirmationPending && !successMsg) setLoading(false);
            if (isRecovery && !error) setLoading(false);
        }
    };

    const toggleRecovery = () => { setIsRecovery(!isRecovery); setError(null); setSuccessMsg(null); };

    // --- CONFIGURATION MODE ---
    if (showConfig) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 to-slate-950"></div>
                <div className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-700 p-8 rounded-3xl shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
                            <Database size={32} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Configurazione Database</h2>
                        <p className="text-slate-400 text-sm mt-2">Inserisci le credenziali del tuo progetto Supabase per connettere l'app.</p>
                    </div>
                    
                    <form onSubmit={handleConfigSave} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Project URL</label>
                            <input 
                                type="text" 
                                value={dbUrl} 
                                onChange={e => setDbUrl(e.target.value)} 
                                placeholder="https://xyz.supabase.co" 
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Anon Public Key</label>
                            <input 
                                type="text" 
                                value={dbKey} 
                                onChange={e => setDbKey(e.target.value)} 
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..." 
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none font-mono text-sm"
                                required
                            />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4">
                            <Save size={20}/> Salva e Connetti
                        </button>
                    </form>
                    {supabase && (
                        <button onClick={() => setShowConfig(false)} className="w-full mt-4 text-slate-500 hover:text-white text-sm font-bold">
                            Annulla
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- MAIN LOGIN SCREEN ---
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1559339352-11d035aa65de?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80')] bg-cover bg-center opacity-10 blur-sm"></div>
            
            <div className="relative z-10 w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-orange-500/30 transform -rotate-3">
                        <ChefHat size={40} className="text-white" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-white tracking-tight">Risto<span className="text-orange-500">Sync</span></h1>
                    <p className="text-slate-400 mt-2 text-sm font-medium uppercase tracking-widest">SaaS Restaurant Management</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl transition-all duration-300">
                    <h2 className="text-2xl font-bold text-white mb-6 text-center">
                        {isRecovery ? 'Recupero Password' : (isLogin ? 'Accedi al Ristorante' : 'Registra Nuovo Locale')}
                    </h2>

                    {confirmationPending && (
                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 p-6 rounded-xl text-center mb-6 animate-fade-in">
                            <Mail size={32} className="mx-auto mb-3 text-blue-400" />
                            <h3 className="font-bold text-lg text-white mb-2">Controlla la tua Email</h3>
                            <p className="text-sm">Link di conferma inviato a <strong>{email}</strong>.</p>
                            <button onClick={() => setConfirmationPending(false)} className="mt-4 text-blue-400 font-bold hover:underline text-sm">Torna al login</button>
                        </div>
                    )}

                    {successMsg && (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-6 rounded-xl text-center mb-6 animate-fade-in">
                            <Send size={32} className="mx-auto mb-3 text-green-500" />
                            <h3 className="font-bold text-lg text-white mb-2">Email Inviata</h3>
                            <p className="text-sm">{successMsg}</p>
                            <button onClick={() => { setIsRecovery(false); setSuccessMsg(null); }} className="mt-4 text-green-400 font-bold hover:underline text-sm">Torna al login</button>
                        </div>
                    )}

                    {!confirmationPending && error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-6 font-bold flex flex-col gap-3 justify-center animate-pulse">
                           <div className="flex items-center justify-center gap-3">
                               <AlertTriangle size={24} className="shrink-0"/>
                               <span>{error}</span>
                           </div>
                           {/* RESET BUTTON IN ERROR BOX */}
                           <button onClick={resetSupabaseConfig} className="text-xs bg-red-500/20 hover:bg-red-500/30 text-white py-2 rounded-lg border border-red-500/30 flex items-center justify-center gap-2">
                               <RefreshCw size={12}/> Resetta Configurazione Database
                           </button>
                        </div>
                    )}

                    {!confirmationPending && !successMsg && (
                        <form onSubmit={handleAuth} className="space-y-4">
                            {!isLogin && !isRecovery && (
                                <div className="relative animate-fade-in">
                                    <ChefHat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                    <input type="text" placeholder="Nome Ristorante" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-colors" required={!isLogin} />
                                </div>
                            )}
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-colors" required />
                            </div>
                            {!isRecovery && (
                                <div className="relative animate-fade-in">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                    <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-12 text-white outline-none focus:border-orange-500 transition-colors" required={!isRecovery} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-2 z-10" tabIndex={-1}>{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                                </div>
                            )}
                            {isLogin && !isRecovery && (
                                <div className="flex justify-end"><button type="button" onClick={toggleRecovery} className="text-xs text-orange-500 font-bold hover:text-orange-400 hover:underline transition-colors">Password dimenticata?</button></div>
                            )}
                            <button type="submit" disabled={loading} className={`w-full text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isRecovery ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'}`}>
                                {loading ? <Loader className="animate-spin" /> : (isRecovery ? 'Invia Link di Reset' : (isLogin ? 'Entra' : 'Prova Gratis 15 Giorni'))} 
                                {!loading && !isRecovery && <ArrowRight size={20} />}
                                {!loading && isRecovery && <Send size={20} />}
                            </button>
                            {isRecovery && (<button type="button" onClick={toggleRecovery} className="w-full py-3 text-slate-400 font-bold text-sm hover:text-white transition-colors flex items-center justify-center gap-2"><ArrowLeft size={16}/> Torna al Login</button>)}
                        </form>
                    )}

                    {!confirmationPending && !isRecovery && !successMsg && (
                        <div className="mt-8 text-center animate-fade-in">
                            <p className="text-slate-500 text-sm">{isLogin ? 'Non hai un account?' : 'Hai già un ristorante?'}<button onClick={() => { setIsLogin(!isLogin); setError(null); }} className="ml-2 text-white font-bold hover:underline">{isLogin ? 'Registrati ora' : 'Accedi'}</button></p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;