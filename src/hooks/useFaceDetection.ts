import { useState, useRef, useCallback, useEffect } from 'react';
import { useFaceRecognition, FaceDetectionResult } from '../services/faceRecognitionService';

export const useFaceDetection = () => {
  const [detectionResult, setDetectionResult] = useState<FaceDetectionResult>({
    faceDetected: false,
    faceCount: 0,
  });
  const [isActive, setIsActive] = useState(false);

  // Grab your service only once
  const faceRecognitionService = useFaceRecognition();

  // We'll stash the video element here once startDetection is called
  const videoRefState = useRef<HTMLVideoElement | null>(null);

  // Re-use a single off-screen canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1) detection logic wrapped in useCallback → stable unless your service changes
  const detect = useCallback(async () => {
    const video = videoRefState.current;
    if (
      !video ||
      video.paused ||
      video.ended ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return;
    }

    // lazy-create canvas
    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // draw frame and run detection
    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    const result = await faceRecognitionService.detectFaces(imageData);

    setDetectionResult(result);
  }, [faceRecognitionService]);

  // 2) effect to start/stop your interval – only when isActive or detect fn changes
 useEffect(() => {
 // run detection once immediately…
   const run = () => {
     detect().catch(console.error);
   };

   run();
const intervalId = window.setInterval(run, 1000);

   return () => {
     window.clearInterval(intervalId);
   };
 }, [isActive, detect]);

  // 3) startDetection simply grabs the video element and flips on isActive
  const startDetection = useCallback((video: HTMLVideoElement) => {
    videoRefState.current = video;
    setIsActive(true);
  }, []);

  // 4) stopDetection turns it off and resets state
  const stopDetection = useCallback(() => {
    setIsActive(false);
    setDetectionResult({ faceDetected: false, faceCount: 0 });
  }, []);

  // your existing capturePhoto logic can stay basically the same
  const capturePhoto = useCallback(
    async (video: HTMLVideoElement): Promise<Blob | null> => {
      if (
        !video ||
        video.paused ||
        video.ended ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        console.error('Video element not ready for capture');
        return null;
      }
      let canvas = canvasRef.current!;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvasRef.current = canvas;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);
      return new Promise(resolve => {
        canvas.toBlob(blob => {
          resolve(blob);
        }, 'image/jpeg', 0.9);
      });
    },
    []
  );

  return {
    detectionResult,
    startDetection,
    stopDetection,
    capturePhoto,
  };
};