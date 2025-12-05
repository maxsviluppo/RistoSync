import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { ChefHat, Mail, Lock, ArrowRight, Loader, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const AuthScreen: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [restaurantName, setRestaurantName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmationPending, setConfirmationPending] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setConfirmationPending(false);
        
        if (!supabase) {
            setError("Connessione al database non configurata. Verifica le chiavi API.");
            setLoading(false);
            return;
        }

        try {
            if (isLogin) {
                // LOGIN
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                // REGISTER
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            restaurant_name: restaurantName
                        }
                    }
                });

                if (signUpError) throw signUpError;
                
                // Check if email confirmation is required by Supabase settings
                if (data.user && !data.session) {
                    setConfirmationPending(true);
                    setLoading(false);
                    return;
                }
                
                // GESTIONE PROFILO (Soft Check)
                if (data.user) {
                     // Tentiamo di creare/verificare il profilo, ma NON blocchiamo l'utente se fallisce subito.
                     // Il trigger SQL lavora in background.
                     try {
                         // Tentativo manuale di sicurezza (se il trigger non parte)
                         await supabase.from('profiles').insert({
                             id: data.user.id,
                             email: email,
                             restaurant_name: restaurantName,
                             subscription_status: 'active'
                         });
                     } catch (e) {
                         // Ignoriamo errori di duplicati (il trigger ha già fatto il suo lavoro)
                         console.log("Insert profile skipped/failed (likely already exists via trigger)");
                     }
                     
                     // Attendiamo un istante per dare tempo al DB
                     await new Promise(r => setTimeout(r, 500));
                }
            }
            // La pagina si ricaricherà o aggiornerà lo stato grazie al listener in App.tsx
        } catch (err: any) {
            let msg = err.message || "Si è verificato un errore.";
            
            // Traduzione errori comuni Supabase
            if (msg.includes("security purposes")) {
                msg = "Troppi tentativi. Attendi circa 60 secondi prima di riprovare.";
            } else if (msg.includes("Invalid login credentials")) {
                msg = "Email o password non corretti.";
            } else if (msg.includes("User already registered")) {
                msg = "Utente già registrato. Prova ad accedere.";
            } else if (msg.includes("Rate limit exceeded")) {
                msg = "Troppe richieste. Rallenta un attimo.";
            }

            setError(msg);
        } finally {
            if (!confirmationPending) setLoading(false);
        }
    };

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

                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
                    <h2 className="text-2xl font-bold text-white mb-6 text-center">
                        {isLogin ? 'Accedi al Ristorante' : 'Registra Nuovo Locale'}
                    </h2>

                    {/* CONFIRMATION PENDING MESSAGE */}
                    {confirmationPending && (
                        <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 p-6 rounded-xl text-center mb-6 animate-fade-in">
                            <Mail size={32} className="mx-auto mb-3 text-blue-400" />
                            <h3 className="font-bold text-lg text-white mb-2">Controlla la tua Email</h3>
                            <p className="text-sm">
                                Ti abbiamo inviato un link di conferma a <strong>{email}</strong>.
                                Cliccalo per attivare l'account.
                            </p>
                            <div className="mt-4 text-xs text-slate-500 bg-slate-950 p-2 rounded border border-slate-800">
                                <strong>Suggerimento Dev:</strong> Se non arriva l'email, vai su Supabase &gt; Authentication &gt; Providers &gt; Email e disabilita "Confirm email".
                            </div>
                            <button 
                                onClick={() => setConfirmationPending(false)}
                                className="mt-4 text-blue-400 font-bold hover:underline text-sm"
                            >
                                Torna al login
                            </button>
                        </div>
                    )}

                    {!confirmationPending && error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm mb-6 font-bold text-center flex items-center gap-3 justify-center">
                           <AlertTriangle size={18} className="shrink-0"/>
                           <span>{error}</span>
                        </div>
                    )}

                    {!confirmationPending && (
                        <form onSubmit={handleAuth} className="space-y-4">
                            {!isLogin && (
                                <div className="relative">
                                    <ChefHat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                    <input 
                                        type="text" 
                                        placeholder="Nome Ristorante"
                                        value={restaurantName}
                                        onChange={e => setRestaurantName(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-colors"
                                        required={!isLogin}
                                    />
                                </div>
                            )}
                            
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input 
                                    type="email" 
                                    placeholder="Email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white outline-none focus:border-orange-500 transition-colors"
                                    required
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-12 pr-12 text-white outline-none focus:border-orange-500 transition-colors"
                                    required
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-2 z-10"
                                    tabIndex={-1}
                                    title={showPassword ? "Nascondi password" : "Mostra password"}
                                >
                                    {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                                </button>
                            </div>

                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader className="animate-spin" /> : (isLogin ? 'Entra' : 'Crea Account')} {!loading && <ArrowRight size={20} />}
                            </button>
                        </form>
                    )}

                    {!confirmationPending && (
                        <div className="mt-8 text-center">
                            <p className="text-slate-500 text-sm">
                                {isLogin ? 'Non hai un account?' : 'Hai già un ristorante?'}
                                <button 
                                    onClick={() => setIsLogin(!isLogin)} 
                                    className="ml-2 text-white font-bold hover:underline"
                                >
                                    {isLogin ? 'Registrati ora' : 'Accedi'}
                                </button>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;