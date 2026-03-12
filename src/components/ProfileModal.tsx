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
  const [name, setName] = useState(session?.user?.user_metadata?.name || session.user.email?.split('@')[0] || '');
  const [surname, setSurname] = useState(session?.user?.user_metadata?.surname || '');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalAvatarUrl(session?.user?.user_metadata?.avatar_url || null);
      setName(session?.user?.user_metadata?.name || session.user.email?.split('@')[0] || '');
      setSurname(session?.user?.user_metadata?.surname || '');
    }
  }, [isOpen, session]);

  if (!session) return null;

  const user = session.user;
  const avatarUrl = localAvatarUrl || user.user_metadata?.avatar_url;
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      setIsUploading(true);
      
      const uploadToast = toast.loading('Caricamento foto...');
      
      // 1. Carica il file su Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('APP-DATA')
        .upload(filePath, file, {
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
      toast.dismiss(uploadToast);
      toast.success('Foto profilo aggiornata!');
      
    } catch (error: any) {
      console.error('Errore durante l\'upload della foto:', error);
      toast.error(error.message || 'Impossibile caricare la foto. Riprova.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 m-auto w-full max-w-md h-[90vh] bg-white rounded-[2.5rem] shadow-2xl z-[70] overflow-hidden border border-slate-100 flex flex-col"
          >
            {/* Header Area with Gradient */}
            <div className="relative h-32 bg-gradient-to-br from-indigo-600 to-violet-700 p-6">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-full backdrop-blur-md transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="absolute -bottom-12 left-8">
                <div className="relative group">
                  <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center border-4 border-white overflow-hidden">
                    <ProfileImage url={avatarUrl} size="large" />
                    
                    {/* Overlay per upload */}
                    <button 
                      onClick={handlePhotoClick}
                      disabled={isUploading}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
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
            <div className="pt-16 pb-8 px-8 overflow-y-auto flex-1">
              <div className="mb-8 flex justify-between items-start">
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-2xl font-black text-slate-900 tracking-tight w-full bg-slate-100 p-2 rounded-lg"
                    />
                  ) : (
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">{name}</h2>
                  )}
                  <div className="flex gap-2 items-center mt-1">
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">
                      {isEditing ? (
                        <span className="text-slate-400">{surname || 'Cognome non impostato'}</span>
                      ) : (
                        surname || 'Cognome non impostato'
                      )}
                    </p>
                    <button 
                      onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                      className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                    >
                      {isEditing ? 'Salva' : 'Modifica'}
                    </button>
                  </div>
                </div>
                {avatarUrl && (
                  <button 
                    onClick={handleDeletePhoto}
                    disabled={isUploading}
                    className="text-[10px] font-black text-rose-400 hover:text-rose-600 uppercase tracking-widest transition-colors"
                  >
                    Rimuovi Foto
                  </button>
                )}
              </div>

              <div className="space-y-4 mb-10">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Email</p>
                    <p className="text-sm font-bold text-slate-700">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Membro dal</p>
                    <p className="text-sm font-bold text-slate-700">{createdAt}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">ID Utente (Generato)</p>
                    <p className="text-[10px] font-mono font-bold text-slate-500 break-all">{generatedId}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                  <Package className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Stato</p>
                  <p className="text-sm font-black text-indigo-700">Attivo</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full mx-auto mb-3 animate-pulse" />
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Sessione</p>
                  <p className="text-sm font-black text-emerald-700">Online</p>
                </div>
              </div>

              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 border border-rose-100"
              >
                <LogOut className="w-4 h-4" />
                Disconnetti Account
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
