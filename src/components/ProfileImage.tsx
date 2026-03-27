import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface ProfileImageProps {
  url?: string;
  size?: 'normal' | 'small' | 'large';
  className?: string;
}

export default function ProfileImage({ url, size = 'normal', className = '' }: ProfileImageProps) {
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    setHasError(false);
    setRetryCount(0);
    setSignedUrl(null);
  }, [url]);

  useEffect(() => {
    if (hasError && url && url.includes('/public/') && !signedUrl) {
      // Se l'URL pubblico fallisce, proviamo a ottenere un URL firmato come fallback
      const getSignedFallback = async () => {
        try {
          // Estraiamo bucket e path dall'URL pubblico
          // Esempio: .../public/APP-DATA/profiles/file.jpg
          const parts = url.split('/public/')[1].split('/');
          const bucket = parts[0];
          const path = parts.slice(1).join('/');
          
          console.log(`Attempting signed URL fallback for ${bucket}/${path}`);
          
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600); // Valido per 1 ora
            
          if (error) {
            console.error('Error creating signed URL:', error);
          } else if (data?.signedUrl) {
            setSignedUrl(data.signedUrl);
            setHasError(false); // Resettiamo l'errore per provare l'URL firmato
          }
        } catch (e) {
          console.error('Fallback signed URL failed:', e);
        }
      };
      getSignedFallback();
    }
  }, [hasError, url, signedUrl]);

  const sizeClasses = {
    small: 'w-4 h-4',
    normal: 'w-5 h-5',
    large: 'w-12 h-12'
  };

  if (url && !hasError) {
    const displayUrl = signedUrl || (retryCount > 0 
      ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` 
      : url);

    return (
      <img 
        src={displayUrl} 
        alt="Profile" 
        className={`w-full h-full object-cover ${className}`}
        referrerPolicy="no-referrer"
        onError={() => {
          if (retryCount < 1 && !signedUrl) {
            console.log('Retrying image load with cache buster:', url);
            setRetryCount(prev => prev + 1);
          } else if (!signedUrl) {
            console.log('Public URL failed, triggering signed fallback:', url);
            setHasError(true);
          } else {
            console.error('Even signed URL failed:', displayUrl);
            setHasError(true);
          }
        }}
      />
    );
  }

  return (
    <div className={`w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-600 ${className}`}>
      <User className={sizeClasses[size]} />
    </div>
  );
}
