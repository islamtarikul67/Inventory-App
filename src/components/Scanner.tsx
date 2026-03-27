import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Upload, X, PenLine, Barcode, RefreshCw, RotateCw, Zap, Bot } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { motion, AnimatePresence } from 'motion/react';

interface ScannerProps {
  onCapture: (base64: string, mimeType: string, isSmart?: boolean) => void;
  onManualEntry: () => void;
  onBarcodeScan: (data: { codice: string, lotto: string }) => void;
}

export default function Scanner({ onCapture, onManualEntry, onBarcodeScan }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isBarcodeMode, setIsBarcodeMode] = useState(false);
  const [isSmartMode, setIsSmartMode] = useState(false);

  // Keep streamRef in sync with stream state
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
        setDevices(videoDevices);
      } catch (err) {
        console.warn('Avviso enumerazione dispositivi:', err);
      }
    };
    getDevices();
  }, []);

  const [isStarting, setIsStarting] = useState(false);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoBlack, setIsVideoBlack] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVideoPlaying && videoRef.current) {
      // Check if video is actually rendering frames after a short delay
      const checkVideo = () => {
        if (videoRef.current && videoRef.current.videoWidth === 0) {
          console.warn("Video is playing but videoWidth is 0. It might be a black screen.");
          setIsVideoBlack(true);
        } else {
          setIsVideoBlack(false);
        }
      };
      
      // Initial check after 2 seconds
      const timeout = setTimeout(() => {
        checkVideo();
        // Then check periodically
        interval = setInterval(checkVideo, 2000);
      }, 2000);
      
      return () => {
        clearTimeout(timeout);
        clearInterval(interval);
      };
    } else {
      setIsVideoBlack(false);
    }
  }, [isVideoPlaying]);

  const startCamera = async (deviceId?: string) => {
    setIsStarting(true);
    setError('');
    setIsVideoPlaying(false);
    setIsVideoBlack(false);
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
              facingMode: { ideal: 'environment' },
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
      // Log as warning instead of error to avoid triggering automatic error reports
      // when the user simply doesn't have a camera
      console.warn('Avviso fotocamera:', err);
      const errorMessage = err?.message || String(err) || "";
      const lowerError = errorMessage.toLowerCase();
      
      if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError' || lowerError.includes('device not found') || lowerError.includes('notfounderror') || lowerError.includes('overconstrainederror')) {
        setError('Nessuna fotocamera trovata. Assicurati che il dispositivo abbia una fotocamera funzionante.');
      } else if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError' || lowerError.includes('not allowed') || lowerError.includes('permission denied')) {
        setError('Accesso negato. Se stai usando l\'anteprima, prova ad aprire l\'app in una NUOVA SCHEDA (pulsante in alto a destra) per concedere i permessi correttamente.');
      } else if (err?.name === 'NotReadableError' || lowerError.includes('could not start') || lowerError.includes('track start error')) {
        setError('La fotocamera è già in uso da un\'altra applicazione o il sistema ha bloccato l\'accesso.');
      } else {
        setError(`Errore fotocamera: ${errorMessage || 'Controlla i permessi del browser.'}`);
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Warning stopping track", e);
        }
      });
      streamRef.current = null;
    }
    setStream(null);
    setIsVideoPlaying(false);
  }, []);

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
        onCapture(dataUrl, 'image/jpeg', isSmartMode);
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
          onCapture(dataUrl, 'image/jpeg', isSmartMode);
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
        console.warn('Forced play failed:', err);
      }
    }
  };

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
            className="flex flex-col gap-4 w-full"
          >
            {/* Main OCR LIVE PRO Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setIsSmartMode(true);
                startCamera();
              }}
              className="relative w-full aspect-[16/10] bg-gradient-to-br from-indigo-600 to-blue-500 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-white shadow-2xl shadow-indigo-200 overflow-hidden group"
            >
              {/* Background Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-[8px] font-black uppercase tracking-widest">AI POWERED</span>
              </div>

              <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center mb-6 border border-white/20 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                <Zap className="w-10 h-10 fill-white" />
              </div>

              <h2 className="text-3xl font-black uppercase tracking-[0.1em] mb-2">OCR LIVE PRO</h2>
              <p className="text-[10px] font-medium text-white/70 uppercase tracking-widest">Scansione intelligente in tempo reale</p>
            </motion.button>

            {/* Secondary Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <motion.button
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setIsSmartMode(false);
                  startCamera();
                }}
                className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 rounded-[2rem] shadow-premium hover:shadow-premium-hover transition-all group"
              >
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                  <Camera className="w-7 h-7" />
                </div>
                <span className="font-black text-slate-700 text-[10px] uppercase tracking-widest">Label Photo</span>
              </motion.button>

              <motion.button
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsBarcodeMode(true)}
                className="flex flex-col items-center justify-center p-6 bg-white border border-slate-100 rounded-[2rem] shadow-premium hover:shadow-premium-hover transition-all group"
              >
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                  <Barcode className="w-7 h-7" />
                </div>
                <span className="font-black text-slate-700 text-[10px] uppercase tracking-widest">Barcode Scan</span>
              </motion.button>
            </div>

            {/* Tertiary Options */}
            <div className="flex gap-3 mt-2">
              <motion.label
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-slate-600 text-[9px] uppercase tracking-widest">Carica</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </motion.label>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onManualEntry}
                className="flex-1 flex items-center justify-center gap-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-slate-100 transition-colors"
              >
                <PenLine className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-slate-600 text-[9px] uppercase tracking-widest">Manuale</span>
              </motion.button>
            </div>
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

            {isVideoBlack && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80 text-white backdrop-blur-md p-6 text-center">
                <div className="bg-white/10 p-6 rounded-[2rem] border border-white/20 backdrop-blur-xl">
                  <p className="text-sm font-bold mb-2">Schermo Nero Rilevato</p>
                  <p className="text-[10px] text-white/60 mb-6 leading-relaxed">
                    Il browser sta bloccando il flusso video (problema comune su iOS/Safari negli iframe).<br/>
                    Per risolvere, apri l'app in una <strong>NUOVA SCHEDA</strong>.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="px-6 py-3 bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform"
                    >
                      Apri in Nuova Scheda
                    </button>
                    <button 
                      onClick={retryCamera}
                      className="px-6 py-3 bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform border border-white/20"
                    >
                      Riprova
                    </button>
                  </div>
                </div>
              </div>
            )}

            <video 
              ref={(el) => {
                videoRef.current = el;
                if (el && stream && el.srcObject !== stream) {
                  el.srcObject = stream;
                  // Force attributes for iOS Safari
                  el.setAttribute('playsinline', 'true');
                  el.setAttribute('webkit-playsinline', 'true');
                  el.setAttribute('muted', 'true');
                  el.muted = true;
                  
                  el.play().then(() => {
                    setIsVideoPlaying(true);
                  }).catch(err => {
                    console.warn('Auto-play failed in ref callback:', err);
                    // We don't set isVideoPlaying to true here so the overlay can show
                  });
                }
              }}
              autoPlay 
              playsInline 
              muted
              onPlay={() => setIsVideoPlaying(true)}
              className="w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className="w-full max-w-[80%] aspect-square relative">
                {/* Top Label */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20">
                  <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Allinea Etichetta Qui</span>
                </div>

                {/* Scanning Frame Corners */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-[6px] border-l-[6px] border-indigo-500 rounded-tl-3xl"></div>
                <div className="absolute top-0 right-0 w-12 h-12 border-t-[6px] border-r-[6px] border-indigo-500 rounded-tr-3xl"></div>
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[6px] border-l-[6px] border-indigo-500 rounded-bl-3xl"></div>
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[6px] border-r-[6px] border-indigo-500 rounded-br-3xl"></div>

                {/* Scanning Line */}
                <motion.div 
                  animate={{ top: ['10%', '90%', '10%'] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute left-4 right-4 h-0.5 bg-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.8)] z-10"
                ></motion.div>

                {/* Status Indicator */}
                <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                    <Bot className="w-3 h-3 text-indigo-300" />
                    <span className="text-[8px] font-black text-indigo-200 uppercase tracking-widest">Analisi...</span>
                  </div>
                  <span className="text-[7px] font-black text-white/40 uppercase tracking-[0.3em]">Auto-Verify Pro</span>
                </div>
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
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping"></div>
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full border-4 border-indigo-100 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                    <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white" />
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
