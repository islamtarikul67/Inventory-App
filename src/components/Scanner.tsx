import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Upload, X, PenLine, Barcode, RefreshCw, RotateCw } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerProps {
  onCapture: (base64: string, mimeType: string) => void;
  onManualEntry: () => void;
  onBarcodeScan: (data: { codice: string, lotto: string }) => void;
}

export default function Scanner({ onCapture, onManualEntry, onBarcodeScan }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isBarcodeMode, setIsBarcodeMode] = useState(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        console.error('Errore enumerazione dispositivi:', err);
      }
    };
    getDevices();
  }, []);

  const [isStarting, setIsStarting] = useState(false);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const startCamera = async (deviceId?: string) => {
    setIsStarting(true);
    setError('');
    setIsVideoPlaying(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'API della fotocamera non è supportata dal tuo browser.");
      }

      stopCamera();

      // Se non abbiamo un deviceId, proviamo a trovarne uno posteriore
      let targetDeviceId = deviceId;
      if (!targetDeviceId && devices.length > 0) {
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('environment') || 
          d.label.toLowerCase().includes('posteriore') ||
          d.label.toLowerCase().includes('rear')
        );
        if (backCamera) {
          targetDeviceId = backCamera.deviceId;
        }
      }

      const constraints: MediaStreamConstraints = {
        video: targetDeviceId 
          ? { deviceId: { exact: targetDeviceId } } 
          : { 
              facingMode: 'environment',
            }
      };

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn('FacingMode environment failed, trying simple video constraint', err);
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      // Ensure all tracks are enabled
      mediaStream.getVideoTracks().forEach(track => {
        track.enabled = true;
      });

      setStream(mediaStream);
      setCurrentDeviceId(targetDeviceId || null);
    } catch (err: any) {
      console.error('Errore fotocamera:', err);
      
      if (err.name === 'NotFoundError' || err.message.includes('Requested device not found')) {
        setError('Nessuna fotocamera trovata. Se sei su PC, assicurati che la webcam sia collegata.');
      } else if (err.name === 'NotAllowedError' || err.name === 'SecurityError' || err.message.includes('not allowed')) {
        setError('Accesso negato. Se stai usando l\'anteprima, prova ad aprire l\'app in una NUOVA SCHEDA (pulsante in alto a destra) per concedere i permessi correttamente.');
      } else if (err.name === 'NotReadableError' || err.message.includes('could not start')) {
        setError('La fotocamera è già in uso da un\'altra applicazione o il sistema ha bloccato l\'accesso.');
      } else {
        setError(`Errore fotocamera: ${err.message || 'Controlla i permessi del browser.'}`);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const switchCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      startCamera(devices[nextIndex].deviceId);
    } else {
      // Se non abbiamo ID, proviamo a forzare l'altra modalità
      startCamera();
    }
  };

  const retryCamera = () => {
    startCamera(currentDeviceId || undefined);
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsVideoPlaying(false);
    }
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current && stream) {
      const canvas = document.createElement('canvas');
      
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = videoRef.current.videoWidth;
      let height = videoRef.current.videoHeight;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Applica un filtro di contrasto e luminosità per migliorare l'OCR
        ctx.filter = 'contrast(1.3) brightness(1.1)';
        ctx.drawImage(videoRef.current, 0, 0, width, height);
        // Ripristina il filtro
        ctx.filter = 'none';
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
        stopCamera();
        onCapture(dataUrl, 'image/jpeg');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Applica un filtro di contrasto e luminosità per migliorare l'OCR
          ctx.filter = 'contrast(1.3) brightness(1.1)';
          ctx.drawImage(img, 0, 0, width, height);
          ctx.filter = 'none';
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          onCapture(dataUrl, 'image/jpeg');
        }
      };
      img.src = objectUrl;
    }
  };

  const forcePlay = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        setIsVideoPlaying(true);
      } catch (err) {
        console.error('Forced play failed:', err);
      }
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      
      const handlePlay = async () => {
        try {
          await video.play();
          setIsVideoPlaying(true);
        } catch (err) {
          console.error('Errore riproduzione video:', err);
          // Retry after a short delay
          setTimeout(() => {
            if (video && stream && stream.active) {
              video.play()
                .then(() => setIsVideoPlaying(true))
                .catch(e => console.error('Retry play failed:', e));
            }
          }, 1000);
        }
      };

      video.onloadedmetadata = handlePlay;
      handlePlay();
      
      return () => {
        video.onloadedmetadata = null;
      };
    }
  }, [stream]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      <AnimatePresence mode="wait">
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full p-4 bg-red-50 text-red-700 rounded-2xl text-sm text-center border border-red-100 shadow-sm mb-6 font-medium"
          >
            {error}
          </motion.div>
        )}
        
        {isBarcodeMode ? (
          <motion.div 
            key="barcode-mode"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full"
          >
            <BarcodeScanner 
              onScan={onBarcodeScan} 
              onClose={() => setIsBarcodeMode(false)} 
            />
          </motion.div>
        ) : !stream ? (
          <motion.div 
            key="selection-mode"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3 sm:gap-5 w-full"
          >
            <motion.button
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => startCamera()}
              className="group flex flex-col items-center justify-center p-5 sm:p-8 bg-white border border-slate-200 rounded-[2rem] sm:rounded-[2.5rem] hover:border-indigo-300 hover:bg-indigo-50/30 transition-all duration-300 shadow-premium hover:shadow-premium-hover"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-100 text-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-5 group-hover:scale-110 transition-transform shadow-inner">
                <Camera className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <span className="font-black text-slate-700 text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em]">OCR Etichetta</span>
            </motion.button>
            
            <motion.button
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsBarcodeMode(true)}
              className="group flex flex-col items-center justify-center p-5 sm:p-8 bg-white border border-slate-200 rounded-[2rem] sm:rounded-[2.5rem] hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-300 shadow-premium hover:shadow-premium-hover"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 text-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-5 group-hover:scale-110 transition-transform shadow-inner">
                <Barcode className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <span className="font-black text-slate-700 text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em]">Scanner Barcode</span>
            </motion.button>
            
            <motion.label
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="group flex flex-col items-center justify-center p-5 sm:p-8 bg-white border border-slate-200 rounded-[2rem] sm:rounded-[2.5rem] hover:border-emerald-300 hover:bg-emerald-50/30 transition-all duration-300 shadow-premium hover:shadow-premium-hover cursor-pointer"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-5 group-hover:scale-110 transition-transform shadow-inner">
                <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <span className="font-black text-slate-700 text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em]">Carica Foto</span>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </motion.label>

            <motion.button
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={onManualEntry}
              className="group flex flex-col items-center justify-center p-5 sm:p-8 bg-white border border-slate-200 rounded-[2rem] sm:rounded-[2.5rem] hover:border-slate-400 hover:bg-slate-50 transition-all duration-300 shadow-premium hover:shadow-premium-hover"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 text-slate-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-5 group-hover:scale-110 transition-transform shadow-inner">
                <PenLine className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <span className="font-black text-slate-700 text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em]">Manuale</span>
            </motion.button>

            <motion.button
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open(window.location.href, '_blank')}
              className="group col-span-2 flex items-center justify-center p-4 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-all duration-300 shadow-sm"
            >
              <RefreshCw className="w-4 h-4 text-indigo-600 mr-2" />
              <span className="font-bold text-indigo-700 text-[10px] uppercase tracking-wider">Problemi con la fotocamera? Apri in nuova scheda</span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div 
            key="camera-mode"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-black aspect-[3/4] shadow-2xl ring-[6px] sm:ring-[12px] ring-white min-h-[300px]"
          >
            {(!stream || isStarting) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 text-white backdrop-blur-md">
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">Avvio Fotocamera...</p>
              </div>
            )}

            {stream && !isVideoPlaying && !isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80 text-white backdrop-blur-md p-6 text-center">
                <div className="bg-white/10 p-6 rounded-[2rem] border border-white/20 backdrop-blur-xl">
                  <p className="text-sm font-bold mb-2">La fotocamera è pronta ma il video non è partito.</p>
                  <p className="text-[10px] text-white/60 mb-6 leading-relaxed">
                    L'ambiente di anteprima potrebbe bloccare il video.<br/>
                    Prova ad aprire l'app in una <strong>NUOVA SCHEDA</strong>.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={forcePlay}
                      className="px-6 py-3 bg-white text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-transform"
                    >
                      Tocca per avviare
                    </button>
                    {devices.length > 1 && (
                      <button 
                        onClick={switchCamera}
                        className="px-6 py-3 bg-indigo-100 text-indigo-700 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
                      >
                        Cambia Fotocamera
                      </button>
                    )}
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-6 py-3 bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
                    >
                      Apri in Nuova Scheda
                    </button>
                  </div>
                </div>
              </div>
            )}

            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted
              onPlay={() => setIsVideoPlaying(true)}
              className="w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 pointer-events-none border-[20px] sm:border-[40px] border-black/40">
              <div className="w-full h-full border-2 border-white/40 rounded-2xl sm:rounded-3xl relative">
                <motion.div 
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute top-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-t-4 border-l-4 border-white -mt-1 -ml-1 rounded-tl-lg sm:rounded-tl-xl"
                ></motion.div>
                <motion.div 
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                  className="absolute top-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-t-4 border-r-4 border-white -mt-1 -mr-1 rounded-tr-lg sm:rounded-tr-xl"
                ></motion.div>
                <motion.div 
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2, delay: 1 }}
                  className="absolute bottom-0 left-0 w-8 h-8 sm:w-12 sm:h-12 border-b-4 border-l-4 border-white -mb-1 -ml-1 rounded-bl-lg sm:rounded-bl-xl"
                ></motion.div>
                <motion.div 
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2, delay: 1.5 }}
                  className="absolute bottom-0 right-0 w-8 h-8 sm:w-12 sm:h-12 border-b-4 border-r-4 border-white -mb-1 -mr-1 rounded-br-lg sm:rounded-br-xl"
                ></motion.div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 flex justify-between items-center bg-gradient-to-t from-black/90 via-black/40 to-transparent">
              <div className="flex gap-3">
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={stopCamera}
                  className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-white/10 text-white rounded-xl sm:rounded-2xl backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 shadow-xl"
                  title="Chiudi"
                >
                  <X className="w-6 h-6 sm:w-7 sm:h-7" />
                </motion.button>

                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={retryCamera}
                  className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-white/10 text-white rounded-xl sm:rounded-2xl backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 shadow-xl"
                  title="Ricarica Fotocamera"
                >
                  <RefreshCw className="w-6 h-6 sm:w-7 sm:h-7" />
                </motion.button>
              </div>
              
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
                onClick={capturePhoto}
                disabled={!isVideoPlaying}
                className={`group relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center ${!isVideoPlaying ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="absolute inset-0 bg-white/20 rounded-full animate-pulse"></div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full border-4 border-slate-200 flex items-center justify-center shadow-2xl transition-transform">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full border border-slate-100 flex items-center justify-center">
                    <div className="w-10 h-10 sm:w-14 sm:h-14 bg-indigo-600/5 rounded-full"></div>
                  </div>
                </div>
              </motion.button>
              
              <div className="flex gap-3">
                {devices.length > 1 && (
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={switchCamera}
                    className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-white/10 text-white rounded-xl sm:rounded-2xl backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 shadow-xl"
                    title="Cambia Fotocamera"
                  >
                    <RotateCw className="w-6 h-6 sm:w-7 sm:h-7" />
                  </motion.button>
                )}
                <div className={devices.length > 1 ? "hidden" : "w-12 sm:w-14"}></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
