import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, RefreshCw, RotateCw, Zap, Loader2, CheckCircle2, Scan, Barcode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractLiveOCRPro, ExtractedData } from '@/services/ocrService';
import jsQR from 'jsqr';

interface LiveOCRScannerProps {
  onScan: (data: ExtractedData) => void;
  onClose: () => void;
}

export default function LiveOCRScanner({ onScan, onClose }: LiveOCRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ExtractedData | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [scanMode, setScanMode] = useState<'barcode' | 'ocr'>('barcode');
  const [status, setStatus] = useState("📷 Avvio camera...");
  const [lastText, setLastText] = useState("");
  const [stabilityCount, setStabilityCount] = useState(0);
  const TARGET_STABILITY = 1; // Richiede 1 rilevamento per essere più veloce e non bloccarsi

  const scanInProgressRef = useRef(false);

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

  const startCamera = async (deviceId?: string) => {
    setIsStarting(true);
    setError('');
    setIsVideoPlaying(false);
    setStatus("📷 Avvio camera...");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'API della fotocamera non è supportata dal tuo browser.");
      }

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

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
          : { facingMode: { ideal: 'environment' } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setCurrentDeviceId(targetDeviceId || null);
      setStatus("🔍 Inquadrando etichetta...");
    } catch (err: any) {
      console.warn('Errore fotocamera:', err);
      setError(`Errore fotocamera: ${err?.message || 'Controlla i permessi.'}`);
    } finally {
      setIsStarting(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setIsVideoPlaying(false);
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const performScan = async () => {
    if (scanInProgressRef.current || !videoRef.current || !isVideoPlaying || status.includes("Verificato")) return;
    
    scanInProgressRef.current = true;
    setIsScanning(true);
    setStatus("🤖 Analisi...");

    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      const width = 640;
      const height = Math.round((video.videoHeight * width) / video.videoWidth);
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        
        // 1. Try Barcode (QR) first
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          setScanMode('barcode');
          
          const result: ExtractedData = {
            codice: code.data,
            descrizione: '',
            lotto: '',
            quantita: 1
          };

          // Barcode è intrinsecamente stabile, ma usiamo comunque un piccolo controllo
          if (code.data === lastText) {
            setStabilityCount(prev => prev + 1);
            if (stabilityCount + 1 >= TARGET_STABILITY) {
              setStatus("✅ Barcode Verificato");
              if (navigator.vibrate) navigator.vibrate(100);
              setTimeout(() => {
                onScan(result);
                stopCamera();
              }, 500);
              return;
            }
          } else {
            setLastText(code.data);
            setStabilityCount(1);
            setLastResult(result);
            if (1 >= TARGET_STABILITY) {
              setStatus("✅ Barcode Verificato");
              if (navigator.vibrate) navigator.vibrate(100);
              setTimeout(() => {
                onScan(result);
                stopCamera();
              }, 500);
              return;
            } else {
              setStatus("✅ Barcode Rilevato");
            }
          }
          return;
        }

        // 2. Fallback to OCR PRO
        setScanMode('ocr');
        ctx.filter = 'contrast(1.4) brightness(1.1)';
        ctx.drawImage(video, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        
        const result = await extractLiveOCRPro(base64, 'image/jpeg');
        
        if (result && (result.codice || result.lotto)) {
          const resultKey = `${result.codice}-${result.lotto}`;
          
          if (resultKey === lastText) {
            setStabilityCount(prev => prev + 1);
            if (stabilityCount + 1 >= TARGET_STABILITY) {
              setStatus("✅ OCR Verificato");
              if (navigator.vibrate) navigator.vibrate(100);
              setTimeout(() => {
                onScan(result);
                stopCamera();
              }, 800);
            } else {
              setStatus(`⏳ Stabilizzazione (${stabilityCount + 1}/${TARGET_STABILITY})`);
            }
          } else {
            setLastText(resultKey);
            setStabilityCount(1);
            setLastResult(result);
            if (1 >= TARGET_STABILITY) {
              setStatus("✅ OCR Verificato");
              if (navigator.vibrate) navigator.vibrate(100);
              setTimeout(() => {
                onScan(result);
                stopCamera();
              }, 800);
            } else {
              setStatus("🔍 OCR Rilevato...");
            }
          }
        } else {
          setStatus("🔍 Inquadrando etichetta...");
          // Non resettiamo subito la stabilità per tollerare un frame perso
          if (stabilityCount > 0) {
             // Opzionale: decrementare invece di resettare
             // setStabilityCount(prev => Math.max(0, prev - 1));
          }
        }
      }
    } catch (err) {
      console.warn("Scan error:", err);
      setStatus("❌ Errore analisi");
    } finally {
      setIsScanning(false);
      scanInProgressRef.current = false;
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (stream && isVideoPlaying) {
      interval = setInterval(performScan, 1500); // Scan slightly faster for stability check
    }
    return () => clearInterval(interval);
  }, [stream, isVideoPlaying, lastText, stabilityCount]);

  const switchCamera = () => {
    if (devices.length > 1) {
      const currentIndex = devices.findIndex(d => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % devices.length;
      startCamera(devices[nextIndex].deviceId);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[3/4] rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-black shadow-2xl ring-[6px] sm:ring-[12px] ring-white">
      <AnimatePresence>
        {(!stream || isStarting) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black text-white"
          >
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">{status}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <video 
        ref={(el) => {
          videoRef.current = el;
          if (el && stream && el.srcObject !== stream) {
            el.srcObject = stream;
            el.setAttribute('playsinline', 'true');
            el.setAttribute('webkit-playsinline', 'true');
            el.setAttribute('muted', 'true');
            el.muted = true;
            el.play().then(() => {
              setIsVideoPlaying(true);
            }).catch(err => {
              console.warn('Auto-play failed in ref callback:', err);
            });
          }
        }}
        autoPlay 
        playsInline 
        muted
        onPlay={() => setIsVideoPlaying(true)}
        className="w-full h-full object-cover"
      />

      {/* Real Scanner Guiding Overlay */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 bg-black/40" style={{ 
          clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 15% 25%, 15% 75%, 85% 75%, 85% 25%, 15% 25%)' 
        }} />
        
        <div className="absolute top-[25%] left-[15%] right-[15%] bottom-[25%] border-2 border-white/50 rounded-2xl">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 -mt-1 -ml-1 rounded-tl-xl" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 -mt-1 -mr-1 rounded-tr-xl" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 -mb-1 -ml-1 rounded-bl-xl" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 -mb-1 -mr-1 rounded-br-xl" />
          
          <motion.div 
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,1)] z-10"
          />

          <div className="absolute -top-10 left-0 right-0 text-center">
            <span className="bg-black/60 backdrop-blur-md text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
              Allinea etichetta qui
            </span>
          </div>
        </div>
      </div>

      {/* Live Results Overlay */}
      <AnimatePresence>
        {lastResult && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-6 left-6 right-6 z-30"
          >
            <div className="bg-white/90 backdrop-blur-xl p-4 rounded-2xl border border-white shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-indigo-600">
                  {scanMode === 'barcode' ? <Barcode className="w-4 h-4" /> : <Zap className="w-4 h-4 fill-current" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {scanMode === 'barcode' ? 'Barcode Rilevato' : 'OCR Rilevato'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                   <div className="text-[9px] font-black text-slate-400 uppercase">{stabilityCount}/{TARGET_STABILITY}</div>
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
              
              {/* Stability Progress Bar */}
              <div className="w-full h-1 bg-slate-100 rounded-full mb-3 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(stabilityCount / TARGET_STABILITY) * 100}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>

              <div className="space-y-2">
                {lastResult.codice && (
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Codice</span>
                    <span className="text-xs font-black text-slate-900">{lastResult.codice}</span>
                  </div>
                )}
                {lastResult.lotto && (
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Lotto</span>
                    <span className="text-xs font-black text-slate-900">{lastResult.lotto}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-3 flex items-center justify-center gap-2 text-emerald-600">
                {stabilityCount >= TARGET_STABILITY ? (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Verificato!</span>
                  </motion.div>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Stabilizzazione...</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent z-40">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center bg-white/10 text-white rounded-xl backdrop-blur-xl border border-white/20"
        >
          <X className="w-6 h-6" />
        </motion.button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-indigo-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">
              {status}
            </span>
          </div>
          <div className="flex items-center gap-1">
             <Scan className="w-3 h-3 text-white/40" />
             <span className="text-[8px] text-white/40 font-bold uppercase">AUTO-VERIFY PRO</span>
          </div>
        </div>

        <div className="flex gap-2">
          {devices.length > 1 && (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={switchCamera}
              className="w-12 h-12 flex items-center justify-center bg-white/10 text-white rounded-xl backdrop-blur-xl border border-white/20"
            >
              <RotateCw className="w-6 h-6" />
            </motion.button>
          )}
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setStabilityCount(0);
              setLastText("");
              startCamera(currentDeviceId || undefined);
            }}
            className="w-12 h-12 flex items-center justify-center bg-white/10 text-white rounded-xl backdrop-blur-xl border border-white/20"
          >
            <RefreshCw className="w-6 h-6" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
