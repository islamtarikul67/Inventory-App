import React from 'react';
import { User } from 'lucide-react';

interface ProfileImageProps {
  url?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function ProfileImage({ url, size = 'medium' }: ProfileImageProps) {
  const sizeClasses = {
    small: 'w-8 h-8',
    medium: 'w-full h-full',
    large: 'w-32 h-32'
  };

  if (!url) {
    return (
      <div className={`${sizeClasses[size]} bg-indigo-50 flex items-center justify-center text-indigo-300`}>
        <User className={size === 'small' ? 'w-4 h-4' : 'w-1/2 h-1/2'} />
      </div>
    );
  }

  return (
    <img 
      src={url} 
      alt="Profile" 
      className={`${sizeClasses[size]} object-cover`}
      referrerPolicy="no-referrer"
    />
  );
}
