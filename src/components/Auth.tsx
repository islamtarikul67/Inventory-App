import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center"
      >
        <motion.div 
          whileHover={{ scale: 1.05, rotate: 5 }}
          className="inline-flex items-center justify-center p-3 sm:p-4 bg-indigo-600 rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl shadow-indigo-200 mb-4 sm:mb-6"
        >
          <PackageSearch className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
        </motion.div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Inventory OCR
        </h2>
        <p className="mt-2 sm:mt-3 text-sm sm:text-base text-slate-500 font-medium px-4">
          {isLogin ? 'Bentornato! Accedi per gestire il tuo inventario.' : 'Inizia ora a digitalizzare il tuo magazzino.'}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-8 sm:mt-10 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-8 sm:py-10 px-5 sm:px-12 shadow-premium border border-slate-100 rounded-[2rem] sm:rounded-[2.5rem] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-indigo-600/10">
            <motion.div 
              className="h-full bg-indigo-600"
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
                className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-2xl flex items-start text-xs font-bold border border-rose-100 shadow-sm"
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
                className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl flex items-start text-xs font-bold border border-emerald-100 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                <span>{message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-6" onSubmit={handleAuth}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
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
                  className={`block w-full pl-14 pr-12 py-4 border-2 rounded-2xl focus:outline-none focus:ring-0 font-bold text-slate-700 placeholder:text-slate-300 transition-all duration-300 ${
                    email.length > 0 
                      ? (emailValid ? 'border-emerald-100 bg-emerald-50/30 focus:border-emerald-500' : 'border-rose-100 bg-rose-50/30 focus:border-rose-500') 
                      : 'border-slate-50 bg-slate-50 focus:border-indigo-500'
                  }`}
                  placeholder="nome@azienda.it"
                />
                {email.length > 0 && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    {emailValid ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-500" />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
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
                  className="block w-full pl-14 pr-12 py-4 border-2 border-slate-50 bg-slate-50 rounded-2xl focus:outline-none focus:ring-0 focus:border-indigo-500 font-bold text-slate-700 placeholder:text-slate-300 transition-all duration-300"
                  placeholder="••••••••"
                  minLength={6}
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-300 hover:text-indigo-500 focus:outline-none transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              
              {!isLogin && password.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 px-1"
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sicurezza:</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${
                      passwordStrength <= 1 ? 'text-rose-500' : 
                      passwordStrength === 2 ? 'text-amber-500' : 
                      passwordStrength === 3 ? 'text-yellow-600' : 'text-emerald-600'
                    }`}>
                      {getStrengthText()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 flex gap-1">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      className={`h-1.5 rounded-full flex-1 ${passwordStrength >= 1 ? getStrengthColor() : 'bg-transparent'} transition-colors duration-500`}
                    ></motion.div>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      className={`h-1.5 rounded-full flex-1 ${passwordStrength >= 2 ? getStrengthColor() : 'bg-transparent'} transition-colors duration-500`}
                    ></motion.div>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      className={`h-1.5 rounded-full flex-1 ${passwordStrength >= 3 ? getStrengthColor() : 'bg-transparent'} transition-colors duration-500`}
                    ></motion.div>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      className={`h-1.5 rounded-full flex-1 ${passwordStrength >= 4 ? getStrengthColor() : 'bg-transparent'} transition-colors duration-500`}
                    ></motion.div>
                  </div>
                </motion.div>
              )}
            </div>

            {!isLogin && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100"
              >
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    id="gdpr"
                    name="gdpr"
                    type="checkbox"
                    required
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                </div>
                <div className="text-xs">
                  <label htmlFor="gdpr" className="font-bold text-slate-700">
                    Accetto l'informativa sulla privacy
                  </label>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    Acconsento al trattamento dei dati personali per le finalità di gestione dell'inventario.
                  </p>
                </div>
              </motion.div>
            )}

            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || !isFormValid}
                className="w-full flex justify-center py-4 px-6 rounded-2xl shadow-xl shadow-indigo-100 text-sm font-black uppercase tracking-[0.2em] text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isLogin ? (
                  <span className="flex items-center gap-2"><LogIn className="w-5 h-5" /> Accedi</span>
                ) : (
                  <span className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Registrati</span>
                )}
              </motion.button>
            </div>
          </form>

          <div className="mt-10">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-white text-slate-400 font-bold uppercase tracking-widest">
                  Oppure
                </span>
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setMessage('');
                }}
                className="w-full flex justify-center py-4 px-6 border-2 border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-200 transition-all active:scale-95"
              >
                {isLogin ? 'Crea un nuovo account' : 'Torna al Login'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]"
      >
        &copy; 2026 Inventory OCR System &bull; v2.6.0 <br/>
        <span className="text-indigo-400">Made by Mohammed</span>
      </motion.p>
    </div>
  );
}
