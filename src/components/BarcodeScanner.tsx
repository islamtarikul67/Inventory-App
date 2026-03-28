import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader2, Check, Barcode, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

interface BarcodeScannerProps {
  onScan: (data: { codice: string, lotto: string }) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string>('');
  const [isStarting, setIsStarting] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoBlack, setIsVideoBlack] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isVideoPlaying) {
      const checkVideo = () => {
        const video = document.querySelector(`#${regionId} video`) as HTMLVideoElement;
        if (video && video.videoWidth === 0) {
          console.warn("BarcodeScanner: Video is playing but videoWidth is 0. It might be a black screen.");
          setIsVideoBlack(true);
        } else {
          setIsVideoBlack(false);
        }
      };
      
      const timeout = setTimeout(() => {
        checkVideo();
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

  const [target, setTarget] = useState<'codice' | 'lotto'>('codice');
  const [codice, setCodice] = useState('');
  const [lotto, setLotto] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isBusyRef = useRef(false);
  const regionId = "html5qr-code-full-region";
  
  const stateRef = useRef({ target, codice, lotto });
  const lastScanTime = useRef<number>(0);

  useEffect(() => {
    stateRef.current = { target, codice, lotto };
  }, [target, codice, lotto]);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  const startScanner = async (cameraIndex?: number) => {
    if (isBusyRef.current) {
      console.warn("Scanner is already transitioning, skipping start request.");
      return;
    }
    
    isBusyRef.current = true;
    setIsStarting(true);
    setError('');
    setIsVideoPlaying(false);
    
    try {
      // Clean up existing scanner instance if it exists
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch (stopErr) {
          console.warn("Non-critical error stopping scanner:", stopErr);
        }
        // Clear the reference to ensure a fresh start
        scannerRef.current = null;
      }
      
      // Ensure the container exists
      const container = document.getElementById(regionId);
      if (!container) {
        throw new Error("Scanner container not found");
      }
      
      scannerRef.current = new Html5Qrcode(regionId);
      
      let cameraIdOrConfig: any = { facingMode: "environment" };
      try {
        const availableDevices = await Html5Qrcode.getCameras();
        setDevices(availableDevices);
        
        if (availableDevices && availableDevices.length > 0) {
          if (cameraIndex !== undefined) {
            cameraIdOrConfig = availableDevices[cameraIndex].id;
            setCurrentCameraIndex(cameraIndex);
          } else {
            const backCamera = availableDevices.find(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('environment') || 
              d.label.toLowerCase().includes('posteriore') ||
              d.label.toLowerCase().includes('rear')
            );
            if (backCamera) {
              cameraIdOrConfig = backCamera.id;
              setCurrentCameraIndex(availableDevices.indexOf(backCamera));
            } else if (availableDevices.length > 1) {
              cameraIdOrConfig = availableDevices[availableDevices.length - 1].id;
              setCurrentCameraIndex(availableDevices.length - 1);
            } else {
              cameraIdOrConfig = availableDevices[0].id;
              setCurrentCameraIndex(0);
            }
          }
        }
      } catch (e) {
        console.warn("Impossibile enumerare le fotocamere, uso fallback facingMode", e);
      }

      await scannerRef.current.start(
        cameraIdOrConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.9);
            return {
              width: qrboxSize,
              height: Math.floor(qrboxSize * 0.8)
            };
          },
          aspectRatio: undefined,
        },
        (decodedText) => {
          const now = Date.now();
          if (now - lastScanTime.current < 1500) return;
          lastScanTime.current = now;
          
          if (navigator.vibrate) navigator.vibrate(200);
          
          const { target: currentTarget, codice: currentCodice, lotto: currentLotto } = stateRef.current;
          
          if (currentTarget === 'codice') {
            setCodice(decodedText);
            toast.success('Codice acquisito!');
            if (!currentLotto) {
              setTarget('lotto');
            }
          } else {
            setLotto(decodedText);
            toast.success('Lotto acquisito!');
            if (!currentCodice) {
              setTarget('codice');
            }
          }
        },
        () => {}
      );
      
      setIsStarting(false);
      // Check if video is actually playing after a short delay
      setTimeout(() => {
        const video = document.querySelector(`#${regionId} video`) as HTMLVideoElement;
        if (video) {
          if (video.paused || video.ended || video.readyState <= 2) {
            setIsVideoPlaying(false);
          } else {
            setIsVideoPlaying(true);
          }
          
          video.onplay = () => setIsVideoPlaying(true);
        }
      }, 1500);

    } catch (err: any) {
      console.error("Error starting barcode scanner:", err);
      const errorMessage = err?.message || String(err) || "";
      const lowerError = errorMessage.toLowerCase();
      
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError' || lowerError.includes('not allowed') || lowerError.includes('permission denied')) {
        setError("Accesso alla fotocamera negato. Prova ad aprire l'app in una NUOVA SCHEDA per concedere i permessi.");
      } else if (err?.name === 'NotFoundError' || lowerError.includes('requested device not found') || lowerError.includes('notfounderror')) {
        setError("Nessuna fotocamera trovata. Assicurati che il dispositivo abbia una fotocamera funzionante.");
      } else if (lowerError.includes('already under transition')) {
        // This is often transient, we don't want to block the UI with a hard error
        console.warn("Scanner was in transition, likely handled by isBusyRef");
      } else {
        setError("Impossibile avviare lo scanner. Assicurati di aver concesso i permessi per la fotocamera.");
      }
      setIsStarting(false);
    } finally {
      isBusyRef.current = false;
    }
  };

  const switchCamera = () => {
    if (devices.length > 1) {
      const nextIndex = (currentCameraIndex + 1) % devices.length;
      startScanner(nextIndex);
    }
  };

  useEffect(() => {
    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const forcePlay = async () => {
    const video = document.querySelector(`#${regionId} video`) as HTMLVideoElement;
    if (video) {
      try {
        await video.play();
        setIsVideoPlaying(true);
      } catch (err) {
        console.error('Forced play failed:', err);
      }
    }
  };

  const handleComplete = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        onScan({ codice, lotto });
      }).catch(console.error);
    } else {
      onScan({ codice, lotto });
    }
  };

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          const video = document.querySelector(`#${regionId} video`) as HTMLVideoElement;
          if (video) {
            video.setAttribute('muted', 'true');
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
            video.muted = true;
            video.playsInline = true;
          }
        }
      });
    });

    const targetNode = document.getElementById(regionId);
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-black aspect-[3/4] shadow-2xl ring-[6px] sm:ring-[12px] ring-white flex flex-col">
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-8 bg-gradient-to-b from-black/90 via-black/40 to-transparent"
        >
          <div className="flex gap-2 sm:gap-4">
            <button
              onClick={() => setTarget('codice')}
              className={`flex-1 py-3 sm:py-4 px-2 sm:px-4 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center border transition-all duration-500 ${
                target === 'codice' 
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' 
                  : 'bg-black/40 border-white/10 text-white/50 hover:bg-black/60 backdrop-blur-md'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Barcode className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${target === 'codice' ? 'animate-pulse' : ''}`} />
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]">Codice</span>
              </div>
              <span className="text-xs sm:text-sm font-black truncate w-full text-center min-h-[16px] sm:min-h-[20px]">
                {codice || 'In attesa...'}
              </span>
            </button>
            
            <button
              onClick={() => setTarget('lotto')}
              className={`flex-1 py-3 sm:py-4 px-2 sm:px-4 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center border transition-all duration-500 ${
                target === 'lotto' 
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-xl scale-105' 
                  : 'bg-black/40 border-white/10 text-white/50 hover:bg-black/60 backdrop-blur-md'
              }`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                <Hash className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${target === 'lotto' ? 'animate-pulse' : ''}`} />
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]">Lotto</span>
              </div>
              <span className="text-xs sm:text-sm font-black truncate w-full text-center min-h-[16px] sm:min-h-[20px]">
                {lotto || 'In attesa...'}
              </span>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {isStarting && !error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 text-white backdrop-blur-md"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/30 blur-3xl rounded-full animate-pulse"></div>
              <div className="relative bg-white/10 p-6 rounded-3xl border border-white/20 backdrop-blur-xl">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
              </div>
            </div>
            <p className="font-black uppercase tracking-[0.2em] text-xs text-indigo-200">Inizializzazione Scanner</p>
          </motion.div>
        )}

        {!isStarting && !isVideoPlaying && !error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80 text-white backdrop-blur-md p-6 text-center"
          >
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
                <button 
                  onClick={handleRetry}
                  className="px-6 py-3 bg-white/5 text-white/60 rounded-2xl font-black uppercase tracking-widest text-[9px] border border-white/10"
                >
                  Riprova inizializzazione
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {isVideoBlack && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80 text-white backdrop-blur-md p-6 text-center"
          >
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
                  onClick={handleRetry}
                  className="px-6 py-3 bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-transform border border-white/20"
                >
                  Riprova
                </button>
              </div>
            </div>
          </motion.div>
        )}
        
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/95 p-10 text-center backdrop-blur-xl"
          >
            <div className="p-8 bg-rose-500/10 text-rose-400 rounded-[2rem] text-sm border border-rose-500/20 shadow-2xl mb-10 font-bold leading-relaxed">
              {error}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-500 active:scale-95 transition-all shadow-xl"
              >
                Ricarica App
              </button>
              <button 
                onClick={onClose}
                className="px-6 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 active:scale-95 transition-all shadow-xl"
              >
                Chiudi
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div id={regionId} className="w-full h-full overflow-hidden" />
      <style>{`
        #${regionId} video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          filter: contrast(1.2) brightness(1.1);
        }
        #${regionId} {
          border: none !important;
        }
        #${regionId}__scan_region {
          border: 2px solid rgba(255, 255, 255, 0.4) !important;
          border-radius: 32px !important;
          box-shadow: 0 0 0 4000px rgba(0, 0, 0, 0.5) !important;
        }
        #${regionId}__scan_region::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #6366f1;
          box-shadow: 0 0 15px #6366f1;
          animation: scan 2s linear infinite;
        }
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 flex justify-between items-center bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20"
      >
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center bg-white/10 text-white rounded-xl sm:rounded-2xl backdrop-blur-xl hover:bg-white/20 transition-all border border-white/20 shadow-xl"
        >
          <X className="w-6 h-6 sm:w-7 sm:h-7" />
        </motion.button>
        
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleComplete}
          disabled={!codice && !lotto}
          className={`group flex items-center gap-2 sm:gap-3 px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[10px] sm:text-xs transition-all duration-500 ${
            codice || lotto 
              ? 'bg-indigo-600 text-white shadow-2xl shadow-indigo-500/40 hover:bg-indigo-500' 
              : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
          }`}
        >
          <Check className={`w-4 h-4 sm:w-5 h-5 transition-transform duration-500 ${codice || lotto ? 'group-hover:scale-125' : ''}`} />
          <span>Concludi</span>
        </motion.button>
      </motion.div>
    </div>
  );
}
