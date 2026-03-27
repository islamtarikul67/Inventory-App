import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogOut, User, Mail, Shield, Calendar } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import ProfileImage from './ProfileImage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onLogout: () => Promise<void>;
}

export default function ProfileModal({ isOpen, onClose, session, onLogout }: ProfileModalProps) {
  if (!session) return null;

  const user = session.user;
  const createdAt = new Date(user.created_at).toLocaleDateString('it-IT', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-3xl shadow-2xl z-[60] overflow-hidden border border-slate-100"
          >
            <div className="relative h-32 bg-indigo-600">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 pb-8">
              <div className="relative -mt-16 mb-6 flex justify-center">
                <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-white">
                  <ProfileImage url={user.user_metadata?.avatar_url} size="large" />
                </div>
              </div>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  {user.user_metadata?.full_name || user.email?.split('@')[0]}
                </h2>
                <p className="text-slate-500 font-medium">{user.email}</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Email</p>
                    <p className="text-sm font-bold text-slate-700">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Ruolo</p>
                    <p className="text-sm font-bold text-slate-700 capitalize">{user.role || 'Operatore'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Membro dal</p>
                    <p className="text-sm font-bold text-slate-700">{createdAt}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-3 py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-black text-sm uppercase tracking-widest transition-all border border-red-100 shadow-sm active:scale-[0.98]"
              >
                <LogOut className="w-5 h-5" />
                Disconnetti
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
