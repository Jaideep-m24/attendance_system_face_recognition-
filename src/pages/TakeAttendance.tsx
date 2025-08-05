import React, { useState, useRef, useEffect } from 'react';
import { Camera, Users, Clock, Check, X, Loader } from 'lucide-react';
import { useFaceRecognition, RecognizedStudent } from '../services/faceRecognitionService';

const TakeAttendance: React.FC = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);  // ← add this
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState<RecognizedStudent[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<string[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceRecognitionService = useFaceRecognition();

  useEffect(() => {
  if (!stream || !videoRef.current) return;
  const video = videoRef.current;

  // 1) attach the stream
  video.srcObject = stream;

  // 2) play it and update state
  video.play()
    .then(() => {
      setVideoReady(true);
      setCameraLoading(false);
      setMessage({
        type: 'success',
        text: 'Camera is live! Position students and click “Take Attendance.”'
      });
    })
    .catch(err => {
      console.error('Video play error:', err);
      setCameraLoading(false);
      setMessage({
        type: 'error',
        text: 'Failed to play video. Check camera permissions.'
      });
    });
}, [stream]);

  useEffect(() => {
    setCurrentPeriod(getCurrentPeriod());
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const getCurrentPeriod = () => {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 9 && hour < 10) return '9-10 AM';
    if (hour >= 10 && hour < 11) return '10-11 AM';
    if (hour >= 11 && hour < 12) return '11-12 PM';
    if (hour >= 12 && hour < 13) return '12-1 PM';
    if (hour >= 13 && hour < 14) return '1-2 PM';
    if (hour >= 14 && hour < 15) return '2-3 PM';
    if (hour >= 15 && hour < 16) return '3-4 PM';
    if (hour >= 16 && hour < 17) return '4-5 PM';
    
    return 'After Hours';
  };

  const startCamera = async () => {
    // 1) indicate loading
   setCameraLoading(true);

   // 2) stop old stream
   if (stream) {
     stream.getTracks().forEach(t => t.stop());
     setStream(null);
   }

   // 3) get a fresh stream and flip your flags
   const mediaStream = await navigator.mediaDevices.getUserMedia({
     video: { width: 1280, height: 720 }
   });
   console.log('Camera stream obtained:', mediaStream);
   setStream(mediaStream);
   setIsCapturing(true);
   // leave the rest to the useEffect below
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCapturing(false);
    setVideoReady(false);
    setRecognizedStudents([]);
    setMessage(null);
  };

  const takeAttendance = async () => {
    if (!videoRef.current || !canvasRef.current || !videoReady) {
      setMessage({ type: 'error', text: 'Camera not ready. Please ensure camera is started.' });
      return;
    }

    setIsProcessing(true);
    setMessage({ type: 'info', text: 'Processing group photo with dlib face recognition...' });

    try {
      // Capture the current frame
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Convert to blob for processing
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        }, 'image/jpeg', 0.9);
      });

      // Process with face recognition service
      const recognized = await faceRecognitionService.recognizeFacesInGroupPhoto(imageBlob, currentPeriod);
      
      setRecognizedStudents(recognized);
      
      // Update attendance records display
      const newRecords = recognized.map(student => 
        `${student.name} - ${new Date().toLocaleTimeString()} (${(student.confidence * 100).toFixed(1)}% match)`
      );
      setAttendanceRecords(prev => [...prev, ...newRecords]);
      
      setMessage({ 
        type: 'success', 
        text: `Successfully recognized ${recognized.length} students using dlib and recorded attendance for ${currentPeriod}!` 
      });
    } catch (error) {
      console.error('Attendance processing error:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to process attendance. Please try again.' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAttendance = () => {
    setAttendanceRecords([]);
    setRecognizedStudents([]);
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Take Attendance</h1>
            <p className="text-gray-600">
              Capture a group photo to automatically recognize students using dlib facial recognition.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Current Period</div>
            <div className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              {currentPeriod}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Camera Feed */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Camera Feed</h2>
          
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
            {stream ? (
              <>
                <video 
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                  {(cameraLoading || !videoReady) && (
                   <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                   <Loader className="h-8 w-8 animate-spin text-white" />
                   </div>
                  )}
                
                {/* Face recognition overlays */}
                {recognizedStudents.map((student, index) => (
                  <div
                    key={index}
                    className="absolute border-2 border-green-400 rounded"
                    style={{
                      left: `${student.position.x}%`,
                      top: `${student.position.y}%`,
                      width: `${student.position.width}%`,
                      height: `${student.position.height}%`,
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-green-400 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
                      {student.name} ({(student.confidence * 100).toFixed(0)}%)
                    </div>
                  </div>
                ))}

                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 space-x-3">
                  <button
                    onClick={takeAttendance}
                    disabled={isProcessing || !videoReady}
                    className="bg-green-600 text-white px-6 py-2 rounded-full shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center"
                  >
                    {isProcessing ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Processing with dlib...
                      </>
                    ) : (
                      <>
                        <Camera className="h-4 w-4 mr-2" />
                        Take Attendance
                      </>
                    )}
                  </button>
                </div>

                {!videoReady && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-white text-center">
                      <Loader className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Loading camera...</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Camera not active</p>
                  <p className="text-sm text-gray-400">Click "Start Camera" to begin</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-3 mt-4">
            {!isCapturing ? (
              <button
                onClick={startCamera}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Stop Camera
              </button>
            )}
            
            <button
              onClick={clearAttendance}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Clear Records
            </button>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Attendance Records */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance</h2>
          
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Students Present</span>
                <span className="text-lg font-bold text-green-600">{recognizedStudents.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Period</span>
                <span className="text-sm text-gray-900">{currentPeriod}</span>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2">
              {attendanceRecords.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No attendance records yet</p>
                  <p className="text-gray-400 text-xs">Take a group photo to get started</p>
                </div>
              ) : (
                attendanceRecords.map((record, index) => (
                  <div key={index} className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Check className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" />
                    <span className="text-sm text-green-800 font-medium truncate">
                      {record}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
          'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' && <Check className="h-5 w-5 mr-2" />}
            {message.type === 'error' && <X className="h-5 w-5 mr-2" />}
            {message.type === 'info' && <Camera className="h-5 w-5 mr-2" />}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Attendance Instructions</h3>
        <div className="space-y-2 text-blue-800">
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">1</span>
            <span>Click "Start Camera" to activate the camera feed</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">2</span>
            <span>Ensure all students are visible and facing the camera</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">3</span>
            <span>Click "Take Attendance" to process with dlib face recognition</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">4</span>
            <span>Review recognized students with confidence scores</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">5</span>
            <span>Attendance is automatically saved to Supabase database</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TakeAttendance;