import React, { useState, useEffect } from 'react';
import Scanner from './components/Scanner';
import InventoryForm from './components/InventoryForm';
import InventoryList from './components/InventoryList';
import Auth from './components/Auth';
import SessionSelector from './components/SessionSelector';
import ProfileModal from './components/ProfileModal';
import ProfileImage from './components/ProfileImage';
import { extractDataFromImage, ExtractedData } from './services/ocrService';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { InventorySession } from './types';
import { PackageSearch, Loader2, List, Camera, LogOut, WifiOff, AlertTriangle, User } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { syncService } from './services/syncService';
import { motion, AnimatePresence } from 'motion/react';
import { SpeedInsights } from "@vercel/speed-insights/react";

type AppState = 'scanning' | 'processing' | 'editing';
type Tab = 'scanner' | 'inventory';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [currentTab, setCurrentTab] = useState<Tab>('scanner');
  const [appState, setAppState] = useState<AppState>('scanning');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = React.useRef(false);
  const [currentSession, setCurrentSession] = useState<InventorySession | null>(() => {
    const saved = localStorage.getItem('last_inventory_session');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (currentSession) {
      localStorage.setItem('last_inventory_session', JSON.stringify(currentSession));
    }
  }, [currentSession]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await syncOfflineData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      syncOfflineData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session]);

  const syncOfflineData = async () => {
    if (!session) return;
    if (isSyncingRef.current) return;
    
    const queue = syncService.getQueue();
    if (queue.length === 0) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    
    try {
      const itemsToInsert = queue.map(item => {
        const { id, timestamp, ...dataToInsert } = item;
        // Se l'item non ha una sessione associata (vecchi salvataggi), usa quella corrente
        if (!dataToInsert.sessione_id && currentSession) {
          dataToInsert.sessione_id = currentSession.id;
        }
        return dataToInsert;
      });

      // Esegui un inserimento batch per massime prestazioni
      const { error } = await supabase.from('inventario').insert(itemsToInsert);
      
      if (!error) {
        syncService.clearQueue();
      } else {
        console.error('Errore durante la sincronizzazione batch:', error);
        // Se il batch fallisce, proviamo uno alla volta come fallback per salvare il salvabile
        let successCount = 0;
        for (const item of queue) {
          const { id, timestamp, ...dataToInsert } = item;
          const { error: singleError } = await supabase.from('inventario').insert([dataToInsert]);
          if (!singleError) {
            syncService.removeFromQueue(id);
            successCount++;
          }
        }
        if (successCount > 0) {
          // Sync success message removed
        }
      }
    } catch (err) {
      console.error('Errore imprevisto durante la sincronizzazione:', err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth session error:", error.message);
          if (error.message.includes('Refresh Token') || error.message.includes('refresh_token')) {
            // Clear supabase auth from local storage manually if signout fails
            Object.keys(localStorage).forEach(key => {
              if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
              }
            });
            await supabase.auth.signOut().catch(() => {});
            setSession(null);
          }
        } else {
          setSession(session);
        }
      } catch (err) {
        console.error("Unexpected error getting session:", err);
        setSession(null);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }
      
      if (event === 'SIGNED_OUT') {
        setSession(null);
        // Clear any leftover auth data
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
      } else {
        setSession(session);
      }

      if (event === 'SIGNED_IN' && session?.user?.email) {
        // Welcome message removed as per user request
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getUserName = () => {
    if (!session?.user?.email) return '';
    return session.user.email.split('@')[0];
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleCapture = async (base64Image: string, mimeType: string) => {
    setAppState('processing');
    setError('');
    
    try {
      const data = await extractDataFromImage(base64Image, mimeType);
      setExtractedData(data);
      setAppState('editing');
    } catch (err: any) {
      console.error("Errore OCR:", err);
      const errorMessage = err?.message || "Errore sconosciuto durante l'analisi dell'immagine.";
      setError(`Impossibile leggere l'etichetta. ${errorMessage.includes('Nessun dato') ? 'Assicurati che l\'immagine contenga un\'etichetta chiara.' : 'Riprova con un\'immagine più nitida o ben illuminata. Suggerimento: inquadra bene l\'etichetta ed evita riflessi.'}`);
      setAppState('scanning');
    }
  };

  const handleReset = () => {
    setExtractedData(null);
    setAppState('scanning');
    setError('');
  };

  const handleManualEntry = () => {
    setExtractedData({
      codice: '',
      descrizione: '',
      lotto: ''
    });
    setAppState('editing');
    setError('');
  };

  const handleBarcodeScan = (data: { codice: string, lotto: string }) => {
    setExtractedData({
      codice: data.codice,
      descrizione: '',
      lotto: data.lotto
    });
    setAppState('editing');
    setError('');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
          <p className="text-slate-500 font-medium animate-pulse">Inizializzazione...</p>
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Toaster position="top-center" gutter={12} containerClassName="mt-16" />
      
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-2 sm:px-6 h-14 sm:h-20 flex items-center justify-between gap-1 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: -5 }}
              whileTap={{ scale: 0.95 }}
              className="w-8 h-8 sm:w-12 sm:h-12 bg-indigo-600 rounded-lg sm:rounded-2xl flex items-center justify-center shadow-indigo-200 shadow-lg sm:shadow-xl"
            >
              <PackageSearch className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </motion.div>
            <div className="hidden xs:block">
              <h1 className="text-sm sm:text-xl font-black tracking-tight text-slate-900 leading-none">Inventory</h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden sm:flex items-center gap-4 flex-1 justify-end">
            <AnimatePresence>
              {!isOnline && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-wider border border-amber-200 shadow-sm"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Offline</span>
                </motion.div>
              )}
            </AnimatePresence>

            <nav className="flex bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
              <button
                onClick={() => setCurrentTab('scanner')}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  currentTab === 'scanner' 
                    ? 'text-indigo-600' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {currentTab === 'scanner' && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-xl shadow-md"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Camera className="w-4 h-4 relative z-10" />
                <span className="hidden xs:inline relative z-10">Scanner</span>
              </button>
              <button
                onClick={() => setCurrentTab('inventory')}
                className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  currentTab === 'inventory' 
                    ? 'text-indigo-600' 
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {currentTab === 'inventory' && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-0 bg-white rounded-xl shadow-md"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <List className="w-4 h-4 relative z-10" />
                <span className="hidden xs:inline relative z-10">Archivio</span>
              </button>
            </nav>
            
            <div className="w-px h-8 bg-slate-200 mx-1 hidden xs:block" />

            <SessionSelector 
              currentSessionId={currentSession?.id || null} 
              onSessionChange={setCurrentSession} 
            />

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <motion.div 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsProfileOpen(true)}
                className="hidden lg:flex items-center gap-3 cursor-pointer group"
              >
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 group-hover:text-indigo-500 transition-colors">Operatore</span>
                  <span className="text-sm font-black text-slate-700 leading-none group-hover:text-slate-900 transition-colors">{getUserName()}</span>
                </div>
                <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm group-hover:border-indigo-100 transition-all">
                  <ProfileImage url={session?.user?.user_metadata?.avatar_url} />
                </div>
              </motion.div>
            </div>
          </div>
          
          {/* Mobile Status Indicator */}
          <div className="sm:hidden flex items-center gap-2">
            <SessionSelector 
              currentSessionId={currentSession?.id || null} 
              onSessionChange={setCurrentSession} 
              dropUp={false}
            />
            <AnimatePresence>
              {!isOnline && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-[8px] font-black uppercase border border-amber-200"
                >
                  <WifiOff className="w-3 h-3" />
                  <span>Offline</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-3 sm:p-6 md:p-10 w-full pb-24 sm:pb-10">
        <AnimatePresence mode="wait">
          {currentTab === 'scanner' ? (
            <motion.div 
              key="scanner-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              {appState === 'scanning' && (
                <div className="w-full max-w-md">
                  {!currentSession && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 text-amber-800 shadow-sm"
                    >
                      <div className="bg-amber-100 p-2 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Azione Richiesta</h4>
                        <p className="text-sm opacity-90">Seleziona o crea una sessione di inventario in alto a destra per iniziare a salvare i dati.</p>
                      </div>
                    </motion.div>
                  )}
                  
                  <div className="text-center mb-6 sm:mb-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 sm:mb-3">Acquisizione Dati</h2>
                    <p className="text-sm sm:text-base text-slate-500 max-w-xs mx-auto">Scegli il metodo di inserimento per aggiornare il tuo inventario.</p>
                  </div>
                  
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-8 p-6 bg-red-50 text-red-700 rounded-3xl text-sm font-medium border border-red-100 shadow-xl text-center"
                    >
                      <div className="mb-4">{error}</div>
                      <button 
                        onClick={handleReset}
                        className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-red-700 transition-colors"
                      >
                        Riprova
                      </button>
                    </motion.div>
                  )}
                  
                  <Scanner 
                    onCapture={handleCapture} 
                    onManualEntry={handleManualEntry} 
                    onBarcodeScan={handleBarcodeScan}
                  />

                  <div className="mt-12 text-center">
                  </div>
                </div>
              )}

              {appState === 'processing' && (
                <div className="flex flex-col items-center justify-center py-32">
                  <div className="relative flex items-center justify-center mb-10">
                    <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                    <div className="relative bg-white p-8 rounded-3xl shadow-2xl border border-indigo-50">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-900 mb-3 tracking-tight">Analisi OCR in corso...</h3>
                  <p className="text-slate-500 text-center max-w-xs font-medium">
                    L'intelligenza artificiale sta leggendo l'etichetta per estrarre codice e lotto.
                  </p>
                </div>
              )}

              {appState === 'editing' && extractedData && (
                <div className="w-full max-w-md">
                  <InventoryForm 
                    initialData={extractedData} 
                    onReset={handleReset} 
                    sessionId={currentSession?.id || null}
                  />
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="inventory-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <InventoryList sessionId={currentSession?.id || null} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-40 px-3 py-2 flex items-center justify-between gap-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <nav className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50">
          <button
            onClick={() => setCurrentTab('scanner')}
            className={`relative flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all duration-300 ${
              currentTab === 'scanner' 
                ? 'text-indigo-600' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {currentTab === 'scanner' && (
              <motion.div 
                layoutId="activeTabMobile"
                className="absolute inset-0 bg-white rounded-md shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Camera className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Scan</span>
          </button>
          <button
            onClick={() => setCurrentTab('inventory')}
            className={`relative flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all duration-300 ${
              currentTab === 'inventory' 
                ? 'text-indigo-600' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {currentTab === 'inventory' && (
              <motion.div 
                layoutId="activeTabMobile"
                className="absolute inset-0 bg-white rounded-md shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <List className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">Archivio</span>
          </button>
        </nav>

        <motion.div 
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsProfileOpen(true)}
          className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 cursor-pointer overflow-hidden border border-indigo-100"
        >
          <ProfileImage url={session?.user?.user_metadata?.avatar_url} size="small" />
        </motion.div>
      </div>
      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        session={session}
        onLogout={handleLogout}
      />
      <SpeedInsights />
    </div>
  );
}
