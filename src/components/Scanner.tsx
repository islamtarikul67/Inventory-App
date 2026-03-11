import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface ScannerProps {
  onCapture: (base64: string, mimeType: string) => void;
}

export default function Scanner({ onCapture }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'API della fotocamera non è supportata dal tuo browser.");
      }

      let mediaStream: MediaStream;
      try {
        // Prova prima a richiedere la fotocamera posteriore (ideale per smartphone)
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
      } catch (err) {
        // Fallback: richiedi qualsiasi fotocamera disponibile (es. webcam su PC desktop)
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
      }

      setStream(mediaStream);
      setError('');
    } catch (err: any) {
      console.error('Errore fotocamera:', err);
      
      // Gestione specifica degli errori più comuni
      if (err.name === 'NotFoundError' || err.message.includes('Requested device not found')) {
        setError('Nessuna fotocamera trovata sul tuo dispositivo. Usa il pulsante "Carica Foto" per selezionare un\'immagine.');
      } else if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
        setError('Permesso negato per la fotocamera. Controlla le impostazioni del browser o usa "Carica Foto".');
      } else {
        setError(`Impossibile accedere alla fotocamera: ${err.message || 'Errore sconosciuto.'}`);
      }
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // Comprime leggermente per performance
        stopCamera();
        onCapture(dataUrl, 'image/jpeg');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onCapture(reader.result as string, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  // Collega lo stream al video element quando è disponibile
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Pulisce lo stream della fotocamera quando il componente viene smontato
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-6">
      {error && (
        <div className="w-full p-4 bg-red-50 text-red-700 rounded-xl text-sm text-center border border-red-100 shadow-sm">
          {error}
        </div>
      )}
      
      {!stream ? (
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={startCamera}
            className="flex flex-col items-center justify-center p-6 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm"
          >
            <Camera className="w-8 h-8 mb-3" />
            <span className="font-medium">Fotocamera</span>
          </button>
          
          <label className="flex flex-col items-center justify-center p-6 bg-emerald-50 text-emerald-700 rounded-2xl hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-100 shadow-sm">
            <Upload className="w-8 h-8 mb-3" />
            <span className="font-medium">Carica Foto</span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </label>
        </div>
      ) : (
        <div className="relative w-full rounded-2xl overflow-hidden bg-black aspect-[3/4] shadow-lg">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted
            className="w-full h-full object-cover"
          />
          
          {/* Overlay mirino */}
          <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
            <div className="w-full h-full border-2 border-white/50 rounded-lg relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white -mb-1 -mr-1"></div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <button 
              onClick={stopCamera}
              className="p-3 bg-white/20 text-white rounded-full backdrop-blur-md hover:bg-white/30 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <button 
              onClick={capturePhoto}
              className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 bg-white rounded-full border border-gray-200"></div>
            </button>
            <div className="w-12"></div> {/* Spaziatore per centrare il bottone di scatto */}
          </div>
        </div>
      )}
    </div>
  );
}
