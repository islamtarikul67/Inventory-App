import React, { useState, useEffect } from 'react';
import Scanner from './components/Scanner';
import InventoryForm from './components/InventoryForm';
import InventoryList from './components/InventoryList';
import Auth from './components/Auth';
import { extractDataFromImage, ExtractedData } from './services/ocrService';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { PackageSearch, Loader2, List, Camera, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

type AppState = 'scanning' | 'processing' | 'editing';
type Tab = 'scanner' | 'inventory';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [currentTab, setCurrentTab] = useState<Tab>('scanner');
  const [appState, setAppState] = useState<AppState>('scanning');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Controlla la sessione all'avvio
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    // Ascolta i cambiamenti di stato dell'autenticazione (login, logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleCapture = async (base64Image: string, mimeType: string) => {
    setAppState('processing');
    setError('');
    
    try {
      // Chiamata all'API OCR (Gemini) per estrarre e parsare i dati
      const data = await extractDataFromImage(base64Image, mimeType);
      setExtractedData(data);
      setAppState('editing');
    } catch (err) {
      console.error(err);
      setError("Impossibile leggere l'etichetta. Riprova con un'immagine più nitida o ben illuminata.");
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

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Toaster position="top-center" />
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <PackageSearch className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Inventory OCR</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setCurrentTab('scanner')}
                className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-colors ${
                  currentTab === 'scanner' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Scanner</span>
              </button>
              <button
                onClick={() => setCurrentTab('inventory')}
                className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium transition-colors ${
                  currentTab === 'inventory' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Inventario</span>
              </button>
            </div>
            
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Esci"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8 flex flex-col items-center w-full">
        
        {currentTab === 'scanner' ? (
          <>
            {appState === 'scanning' && (
              <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center mb-8 mt-4">
                  <h2 className="text-2xl font-semibold mb-2">Scansiona Etichetta</h2>
                  <p className="text-gray-500">Inquadra l'etichetta del prodotto per estrarre automaticamente i dati.</p>
                </div>
                
                {error && (
                  <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm text-center border border-red-100 shadow-sm">
                    {error}
                  </div>
                )}
                
                <Scanner onCapture={handleCapture} onManualEntry={handleManualEntry} />
              </div>
            )}

            {appState === 'processing' && (
              <div className="flex flex-col items-center justify-center py-24 animate-in fade-in zoom-in-95 duration-300">
                <div className="relative flex items-center justify-center mb-8">
                  <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                  <div className="relative bg-white p-5 rounded-full shadow-lg border border-indigo-50">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Elaborazione OCR in corso...</h3>
                <p className="text-gray-500 text-center max-w-xs">
                  Lettura dell'etichetta ed estrazione dei dati tramite intelligenza artificiale.
                </p>
              </div>
            )}

            {appState === 'editing' && extractedData && (
              <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                <InventoryForm 
                  initialData={extractedData} 
                  onReset={handleReset} 
                />
              </div>
            )}
          </>
        ) : (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <InventoryList />
          </div>
        )}

      </main>
    </div>
  );
}
