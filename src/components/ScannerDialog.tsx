import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, RotateCcw, Loader2, ScanLine } from 'lucide-react';
import { createWorker, Worker } from 'tesseract.js';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScanResult: (text: string) => void;
  title?: string;
  hint?: string;
}

export default function ScannerDialog({
  open,
  onOpenChange,
  onScanResult,
  title = 'Scan with Camera',
  hint = 'Point camera at the smartcard or serial number',
}: ScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      setCameraError('Camera access denied. Please allow camera permissions.');
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const captureAndRecognize = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the current video frame
    ctx.drawImage(video, 0, 0);

    // Enhance for OCR: grayscale + increase contrast
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const enhanced = gray > 128 ? 255 : 0; // threshold for sharper text
      data[i] = enhanced;
      data[i + 1] = enhanced;
      data[i + 2] = enhanced;
    }
    ctx.putImageData(imageData, 0, 0);

    setIsProcessing(true);

    try {
      if (!workerRef.current) {
        workerRef.current = await createWorker('eng');
      }

      const { data: result } = await workerRef.current.recognize(canvas);
      const text = result.text.trim();

      // Extract likely smartcard/serial numbers: alphanumeric sequences of 8+ chars
      const matches = text.replace(/[^A-Za-z0-9\n ]/g, '').match(/[A-Za-z0-9]{8,14}/g);

      if (matches && matches.length > 0) {
        // Return the best match (longest alphanumeric sequence)
        const best = matches.sort((a, b) => b.length - a.length)[0];
        onScanResult(best);
        onOpenChange(false);
      } else {
        setCameraError('No number detected. Please try again — hold steady and ensure good lighting.');
        setTimeout(() => setCameraError(null), 3000);
      }
    } catch {
      setCameraError('OCR processing failed. Please try again.');
      setTimeout(() => setCameraError(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Restart camera when facing mode changes
  useEffect(() => {
    if (open) {
      startCamera();
    }
  }, [facingMode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            {title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </DialogHeader>

        <div className="relative bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Scan guide overlay */}
          {cameraReady && !isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[80%] h-16 border-2 border-primary/70 rounded-lg">
                <div className="w-full h-0.5 bg-primary/50 animate-pulse mt-7" />
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Reading text...</span>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {cameraError && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
              <p className="text-white text-sm text-center">{cameraError}</p>
            </div>
          )}

          {/* Hidden canvas for OCR processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-4 pt-2 flex gap-2">
          <Button
            onClick={captureAndRecognize}
            disabled={!cameraReady || isProcessing}
            className="flex-1 btn-primary-gradient"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Capture & Read
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={toggleCamera} disabled={isProcessing}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
