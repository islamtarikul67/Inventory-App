import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, Calendar, Shield, LogOut, Package, Camera, Loader2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import ProfileImage from './ProfileImage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onLogout: () => void;
}

export default function ProfileModal({ isOpen, onClose, session, onLogout }: ProfileModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState(session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || '');
  const [surname, setSurname] = useState(session?.user?.user_metadata?.surname || '');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalAvatarUrl(session?.user?.user_metadata?.avatar_url || null);
      setPreviewUrl(null);
      setSelectedFile(null);
      setName(session?.user?.user_metadata?.name || session?.user?.email?.split('@')[0] || '');
      setSurname(session?.user?.user_metadata?.surname || '');
    }
  }, [isOpen, session]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!session) return null;

  const user = session.user;
  const avatarUrl = previewUrl || localAvatarUrl || user.user_metadata?.avatar_url;
  const createdAt = new Date(user.created_at).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const generatedId = `${name.toLowerCase().replace(/\s+/g, '')}${surname.toLowerCase().replace(/\s+/g, '')}`;

  const handleSaveProfile = async () => {
    try {
      setIsUploading(true);
      const { error } = await supabase.auth.updateUser({
        data: { name, surname }
      });
      if (error) throw error;
      await supabase.auth.refreshSession();
      setIsEditing(false);
      toast.success('Profilo aggiornato!');
    } catch (error: any) {
      toast.error('Errore durante il salvataggio.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validazione base
    if (!file.type.startsWith('image/')) {
      toast.error('Per favore seleziona un\'immagine valida');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'immagine è troppo grande (max 2MB)');
      return;
    }

    // Imposta la preview locale e il file selezionato
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setSelectedFile(file);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      
      const uploadToast = toast.loading('Caricamento foto...');
      
      // 1. Carica il file su Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('APP-DATA')
        .upload(filePath, selectedFile, {
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) {
        toast.dismiss(uploadToast);
        if (uploadError.message.includes('row-level security')) {
          throw new Error('Errore di permessi (RLS) su Supabase Storage. Assicurati che il bucket "APP-DATA" abbia le policy corrette.');
        }
        throw uploadError;
      }

      // 2. Ottieni l'URL pubblico
      const { data: { publicUrl } } = supabase.storage
        .from('APP-DATA')
        .getPublicUrl(filePath);

      // 3. Aggiorna i metadati dell'utente
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) {
        toast.dismiss(uploadToast);
        throw updateError;
      }

      // 4. Forza il refresh della sessione per aggiornare i metadati ovunque
      await supabase.auth.refreshSession();

      setLocalAvatarUrl(publicUrl);
      setSelectedFile(null);
      toast.dismiss(uploadToast);
      toast.success('Foto profilo aggiornata!');
      
    } catch (error: any) {
      console.error('Errore durante l\'upload della foto:', error);
      toast.error(error.message || 'Impossibile caricare la foto. Riprova.');
      setPreviewUrl(null); // Revert preview on error
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCancelUpload = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeletePhoto = async () => {
    try {
      setIsUploading(true);
      const deleteToast = toast.loading('Rimozione foto...');

      // Aggiorna i metadati dell'utente impostando avatar_url a null
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: null }
      });

      if (updateError) throw updateError;

      await supabase.auth.refreshSession();
      setLocalAvatarUrl(null);
      setPreviewUrl(null);
      toast.dismiss(deleteToast);
      toast.success('Foto profilo rimossa');
    } catch (error: any) {
      console.error('Errore durante la rimozione della foto:', error);
      toast.error('Impossibile rimuovere la foto. Riprova.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="fixed inset-0 m-auto w-full max-w-md h-[85vh] sm:h-[650px] bg-white sm:rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] z-[70] overflow-hidden flex flex-col"
          >
            {/* Header Area with Gradient */}
            <div className="relative h-36 bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 p-6 shrink-0">
              {/* Glassmorphism elements inside header */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/20 rounded-full blur-2xl overflow-hidden"></div>
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/20 to-transparent overflow-hidden"></div>
              
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-black/10 hover:bg-black/20 text-white rounded-full backdrop-blur-md transition-all z-10"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="absolute -bottom-12 left-8 z-20">
                <div className="relative group">
                  <div className="w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-white overflow-hidden">
                    <ProfileImage url={avatarUrl} size="large" />
                    
                    {/* Overlay per upload */}
                    <button 
                      onClick={handlePhotoClick}
                      disabled={isUploading}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-sm"
                    >
                      {isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="pt-16 pb-6 px-8 overflow-y-auto flex-1 bg-white">
              <div className="mb-8">
                {isEditing ? (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Nome</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="Il tuo nome"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Cognome</label>
                        <input
                          type="text"
                          value={surname}
                          onChange={(e) => setSurname(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-semibold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="Il tuo cognome"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button 
                        onClick={handleSaveProfile}
                        disabled={isUploading}
                        className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva'}
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditing(false);
                          setName(session?.user?.user_metadata?.name || session.user.email?.split('@')[0] || '');
                          setSurname(session?.user?.user_metadata?.surname || '');
                        }}
                        className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors"
                      >
                        Annulla
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-start"
                  >
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                      {name} {surname}
                    </h2>
                    
                    {selectedFile ? (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <button 
                          onClick={handleConfirmUpload}
                          disabled={isUploading}
                          className="text-[10px] font-bold text-white uppercase tracking-wider transition-colors bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-full flex items-center gap-1"
                        >
                          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Conferma Foto
                        </button>
                        <button 
                          onClick={handleCancelUpload}
                          disabled={isUploading}
                          className="text-[10px] font-bold text-slate-600 hover:text-slate-700 uppercase tracking-wider transition-colors bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full flex items-center gap-1"
                        >
                          <X className="w-3 h-3" />
                          Annulla
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <button 
                          onClick={() => setIsEditing(true)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider transition-colors bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full"
                        >
                          Modifica Profilo
                        </button>
                        {avatarUrl && (
                          <button 
                            onClick={handleDeletePhoto}
                            disabled={isUploading}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 uppercase tracking-wider transition-colors bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full"
                          >
                            Rimuovi Foto
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              <div className="space-y-3 mb-8">
                <div className="flex items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mr-4 shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mr-4 shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Membro dal</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{createdAt}</p>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-violet-50 rounded-full flex items-center justify-center text-violet-600 mr-4 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ID Utente</p>
                    <p className="text-xs font-mono font-medium text-slate-500 truncate">{generatedId}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                  <Package className="w-5 h-5 text-slate-400 mb-2" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Stato</p>
                  <p className="text-sm font-bold text-slate-700">Attivo</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mb-3 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sessione</p>
                  <p className="text-sm font-bold text-slate-700">Online</p>
                </div>
              </div>

              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full py-3.5 bg-white hover:bg-rose-50 text-rose-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border border-rose-100 hover:border-rose-200 shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                Disconnetti Account
              </button>
              
              <div className="mt-6 text-center">
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  Version 2.6.0 (Build 103) <br/>
                  <span className="text-indigo-400">Made by Mohammed</span>
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
