import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { extractDataFromImage, ExtractedData } from '../services/ocrService';

interface LiveOCRProps {
  onDataExtracted: (data: ExtractedData) => void;
  onClose: () => void;
}

export default function LiveOCR({ onDataExtracted, onClose }: LiveOCRProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError('Impossibile accedere alla fotocamera.');
      }
    };
    startCamera();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const captureFrame = useCallback(async () => {
    if (videoRef.current && !isProcessing) {
      setIsProcessing(true);
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        try {
          const data = await extractDataFromImage(dataUrl, 'image/jpeg');
          onDataExtracted(data);
        } catch (err) {
          console.error('OCR error:', err);
        } finally {
          setIsProcessing(false);
        }
      }
    }
  }, [isProcessing, onDataExtracted]);

  useEffect(() => {
    const interval = setInterval(captureFrame, 2000); // Scan every 2 seconds
    return () => clearInterval(interval);
  }, [captureFrame]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <div className="absolute top-4 right-4">
        <button onClick={onClose} className="p-2 bg-white/20 rounded-full text-white">
          <X />
        </button>
      </div>
      {isProcessing && (
        <div className="absolute bottom-4 left-4 p-2 bg-white/80 rounded-full">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        </div>
      )}
      {error && <div className="absolute top-20 text-red-500">{error}</div>}
    </div>
  );
}
