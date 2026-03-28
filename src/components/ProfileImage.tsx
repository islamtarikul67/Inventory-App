import React from 'react';
import { User } from 'lucide-react';

interface Props {
  url?: string;
}

export default function ProfileImage({ url }: Props) {
  if (url) {
    return <img src={url} alt="Profile" className="w-full h-full object-cover" />;
  }
  return <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500"><User size={20} /></div>;
}
