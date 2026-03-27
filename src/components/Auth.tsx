import React, { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { Loader2, Mail, Lock, LogIn, UserPlus, AlertCircle, PackageSearch, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setEmailValid(validateEmail(val));
  };

  const calculateStrength = (pass: string) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return Math.min(4, score);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordStrength(calculateStrength(val));
  };

  const getStrengthColor = () => {
    if (password.length === 0) return 'bg-slate-200';
    switch (passwordStrength) {
      case 1: return 'bg-rose-400';
      case 2: return 'bg-amber-400';
      case 3: return 'bg-yellow-400';
      case 4: return 'bg-emerald-500';
      default: return 'bg-slate-200';
    }
  };

  const getStrengthText = () => {
    if (password.length === 0) return '';
    switch (passwordStrength) {
      case 1: return 'Debole';
      case 2: return 'Discreta';
      case 3: return 'Buona';
      case 4: return 'Forte';
      default: return '';
    }
  };

  const isFormValid = emailValid && password.length >= 6;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Account creato con successo! Per favore, controlla la tua email e verifica l\'indirizzo prima di effettuare l\'accesso.');
        setPassword('');
        setIsLogin(true);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Si è verificato un errore durante l\'autenticazione.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-100 selection:text-indigo-900 relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10"
      >
        <motion.div 
          whileHover={{ scale: 1.05, rotate: 5 }}
          className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-2xl shadow-indigo-200/50 mb-6 sm:mb-8 p-0.5"
        >
          <div className="w-full h-full bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
            <PackageSearch className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-lg" />
          </div>
        </motion.div>
        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-3">
          Inventory OCR
        </h2>
        <p className="text-sm sm:text-base text-slate-500 font-medium px-4 opacity-80">
          {isLogin ? 'Bentornato! Accedi per gestire il tuo inventario.' : 'Inizia ora a digitalizzare il tuo magazzino.'}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        {/* Ambient Glow behind card */}
        <div className="absolute inset-0 bg-indigo-500/5 blur-3xl -z-10 rounded-[2.5rem]" />
        
        <div className="glass-morphism py-10 sm:py-12 px-6 sm:px-12 rounded-[2.5rem] sm:rounded-[3rem] relative overflow-hidden border border-white/60">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              initial={{ width: "50%" }}
              animate={{ width: isLogin ? "50%" : "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-4 bg-rose-50/50 backdrop-blur-sm text-rose-700 rounded-2xl flex items-start text-xs font-bold border border-rose-100 shadow-sm"
              >
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-8 p-4 bg-emerald-50/50 backdrop-blur-sm text-emerald-700 rounded-2xl flex items-start text-xs font-bold border border-emerald-100 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                <span>{message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-7" onSubmit={handleAuth}>
            <div className="space-y-2.5">
              <label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] ml-2">
                Indirizzo Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className={`h-5 w-5 transition-colors duration-300 ${email.length > 0 ? 'text-indigo-500' : 'text-slate-300'}`} />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  autoFocus
                  value={email}
                  onChange={handleEmailChange}
                  className={`premium-input pl-14 pr-12 ${
                    email.length > 0 
                      ? (emailValid ? 'border-emerald-100 bg-emerald-50/20 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-rose-100 bg-rose-50/20 focus:border-rose-500 focus:shadow-[0_0_15px_rgba(244,63,94,0.1)]') 
                      : ''
                  }`}
                  placeholder="nome@azienda.it"
                />
                <AnimatePresence>
                  {email.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none"
                    >
                      {emailValid ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-rose-500" />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="space-y-2.5">
              <label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] ml-2">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className={`h-5 w-5 transition-colors duration-300 ${password.length > 0 ? 'text-indigo-500' : 'text-slate-300'}`} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={handlePasswordChange}
                  className="premium-input pl-14 pr-14"
                  placeholder="••••••••"
                  minLength={6}
                />
                <div className="absolute inset-y-0 right-0 pr-5 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-300 hover:text-indigo-500 focus:outline-none transition-colors p-1"
                  >
                    <AnimatePresence mode="wait">
                      {showPassword ? (
                        <motion.div key="off" initial={{ opacity: 0, rotate: -45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: 45 }}>
                          <EyeOff className="h-5 w-5" />
                        </motion.div>
                      ) : (
                        <motion.div key="on" initial={{ opacity: 0, rotate: 45 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0, rotate: -45 }}>
                          <Eye className="h-5 w-5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </div>
              
              {!isLogin && password.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-4 px-2"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sicurezza:</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      passwordStrength <= 1 ? 'text-rose-500' : 
                      passwordStrength === 2 ? 'text-amber-500' : 
                      passwordStrength === 3 ? 'text-yellow-600' : 'text-emerald-600'
                    }`}>
                      {getStrengthText()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 flex gap-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <motion.div 
                        key={step}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        className={`h-1.5 rounded-full flex-1 ${passwordStrength >= step ? getStrengthColor() : 'bg-slate-100'} transition-colors duration-500 origin-left`}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {!isLogin && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-4 p-5 bg-slate-50/50 rounded-[1.5rem] border border-slate-100 shadow-sm"
              >
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    id="gdpr"
                    name="gdpr"
                    type="checkbox"
                    required
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="text-xs">
                  <label htmlFor="gdpr" className="font-black text-slate-700 uppercase tracking-wide">
                    Privacy Policy
                  </label>
                  <p className="text-slate-400 mt-1 leading-relaxed font-medium">
                    Acconsento al trattamento dei dati personali per le finalità di gestione dell'inventario.
                  </p>
                </div>
              </motion.div>
            )}

            <div className="pt-4">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98, y: 0 }}
                type="submit"
                disabled={loading || !isFormValid}
                className="w-full flex justify-center py-5 px-6 rounded-[1.5rem] shadow-2xl shadow-indigo-200/50 text-xs font-black uppercase tracking-[0.25em] text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isLogin ? (
                  <span className="flex items-center gap-3"><LogIn className="w-5 h-5" /> Accedi</span>
                ) : (
                  <span className="flex items-center gap-3"><UserPlus className="w-5 h-5" /> Registrati</span>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-12">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-5 bg-white/50 backdrop-blur-sm text-slate-400 font-black uppercase tracking-[0.3em]">
                  Oppure
                </span>
              </div>
            </div>

            <div className="mt-10">
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setMessage('');
                }}
                className="w-full flex justify-center py-4.5 px-6 border-2 border-slate-100 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-white/50 hover:bg-white hover:border-indigo-100 hover:text-indigo-600 transition-all shadow-sm"
              >
                {isLogin ? 'Crea un nuovo account' : 'Torna al Login'}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
      
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center space-y-3"
      >
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">
          &copy; 2026 Inventory OCR System &bull; v2.7.0 (Build 104)
        </p>
        <div className="flex items-center justify-center gap-2 opacity-40">
          <div className="h-px w-8 bg-slate-300" />
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Enterprise Grade Security</span>
          <div className="h-px w-8 bg-slate-300" />
        </div>
      </motion.footer>
    </div>
  );
}
