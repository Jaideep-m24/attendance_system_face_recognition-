import React, { useState, useRef, useEffect } from 'react';
import { Camera, User, Check, X, Loader, AlertTriangle } from 'lucide-react';
import { useFaceDetection } from '../hooks/useFaceDetection';
import { useFaceRecognition } from '../services/faceRecognitionService';

const RegisterStudents: React.FC = () => {
  const [studentName, setStudentName] = useState('');
  const [photoCount, setPhotoCount] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning', text: string } | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<Blob[]>([]);
  const [videoReady, setVideoReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(1);   // ← new: track 1…10

  const videoRef = useRef<HTMLVideoElement>(null);
  const { detectionResult, startDetection, stopDetection, capturePhoto } = useFaceDetection();
  const faceRecognitionService = useFaceRecognition();

  const targetPhotos = 10;

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    if (isCapturing && videoReady && videoRef.current && stream) {
      console.log('Starting face detection...');
      startDetection(videoRef.current);
    } else {
      stopDetection();
    }
  }, [isCapturing, videoReady, stream, startDetection, stopDetection]);

  useEffect(() => {
  if (!stream || !videoRef.current) return;

  const video = videoRef.current;
  video.srcObject = stream;

  // Optional: add a red border while debugging
  video.style.border = '2px solid red';

  video
    .play()
    .then(() => {
      setVideoReady(true);
      setIsCapturing(true);
      setCameraLoading(false);
      setMessage({ type: 'success', text: 'Camera stream live!' });
    })
    .catch(err => {
      console.error('Video play error:', err);
      setMessage({ type: 'error', text: 'Failed to start video playback.' });
      setCameraLoading(false);
    });

  return () => {
    // cleanup if stream changes
    video.srcObject = null;
  };
}, [stream]);

  const startCamera = async () => {
    try {
      setCameraLoading(true);
      setMessage({ type: 'info', text: 'Requesting camera access...' });
      
      // Stop any existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user'
        },
        audio: false
      });
      
      console.log('Camera stream obtained:', mediaStream);
      setStream(mediaStream);
      setMessage({ type: 'info', text: 'Camera access granted. Loading video...' });
      
      if (videoRef.current) {
        const video = videoRef.current;
        
        // Reset video state
        setVideoReady(false);
        setIsCapturing(false);
        
        // Set up event handlers
        const handleLoadedMetadata = () => {
          console.log('Video metadata loaded:', {
            width: video.videoWidth,
            height: video.videoHeight,
            readyState: video.readyState
          });
          setMessage({ type: 'info', text: 'Video loaded. Starting playback...' });
        };

        const handleCanPlay = () => {
          console.log('Video can play, attempting to start...');
          video.play()
            .then(() => {
              console.log('Video playing successfully');
              // Wait a bit more to ensure video is fully ready
              setTimeout(() => {
                if (video.videoWidth > 0 && video.videoHeight > 0 && !video.paused) {
                  setVideoReady(true);
                  setIsCapturing(true);
                  setCameraLoading(false);
                  setMessage({ type: 'info', text: 'Camera ready! Position your face in the frame.' });
                } else {
                  console.log('Video still not ready after play, retrying...');
                  setTimeout(() => {
                    if (video.videoWidth > 0 && video.videoHeight > 0) {
                      setVideoReady(true);
                      setIsCapturing(true);
                      setCameraLoading(false);
                      setMessage({ type: 'info', text: 'Camera ready! Position your face in the frame.' });
                    }
                  }, 1000);
                }
              }, 500);
            })
            .catch((error) => {
              console.error('Video play error:', error);
              setMessage({ type: 'error', text: 'Failed to start video playback. Please try again.' });
              setCameraLoading(false);
            });
        };

        const handleError = (error: any) => {
          console.error('Video error:', error);
          setMessage({ type: 'error', text: 'Video error occurred. Please try restarting the camera.' });
          setCameraLoading(false);
        };

        const handleLoadStart = () => {
          console.log('Video load started');
        };

        // Remove existing event listeners
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('loadstart', handleLoadStart);

        // 1) attach the stream to the <video>
        video.srcObject = mediaStream;

  // 2) kick off playback right away
        try {
          await video.play();
          // now we know it’s rendering
          setVideoReady(true);
          setIsCapturing(true);
          setCameraLoading(false);
          setMessage({ type: 'success', text: 'Camera stream live!' });
        } catch (err) {
        console.error('Couldn’t play video:', err);
        setMessage({ type: 'error', text: 'Failed to start video. Check permissions.' });
        setCameraLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Camera access error:', error);
      setCameraLoading(false);
      
      let errorMessage = 'Failed to access camera. ';
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else {
        errorMessage += 'Please check your camera settings and try again.';
      }
      
      setMessage({ type: 'error', text: errorMessage });
    }
  };

  const stopCamera = () => {
    console.log('Stopping camera');
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      setStream(null);
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCapturing(false);
    setVideoReady(false);
    setCameraLoading(false);
    stopDetection();
    setMessage(null);
  };

  const handleCapturePhoto = async () => {
    if (!videoRef.current || !videoReady) {
      setMessage({ type: 'warning', text: 'Camera not ready. Please wait for video to load.' });
      return;
    }

    if (!stream || stream.getTracks().length === 0) {
      setMessage({ type: 'warning', text: 'Camera stream not available. Please restart camera.' });
      return;
    }

    try {
      setMessage({ type: 'info', text: 'Capturing photo...' });
      
      const photoBlob = await capturePhoto(videoRef.current);
      if (photoBlob) {
        // Store photo in Supabase Storage
        // send the current slot index…
        await faceRecognitionService.storeStudentPhoto(
          studentName,
          photoBlob,
          photoIndex               // ← use photoIndex instead of photoCount+1
          );
          // record it locally…
          setCapturedPhotos(prev => [...prev, photoBlob]);
          setPhotoCount(photoIndex); // ← now photoCount matches the slot you just saved
          setPhotoIndex(idx => idx + 1); // ← advance to the next slot (up to 10)
        
       if (photoCount >= targetPhotos) {
          setMessage({ type: 'success', text: `Successfully captured ${targetPhotos} photos! Ready to register.` });
          } else {
          setMessage({ type: 'info', text: `Photo ${photoCount}/${targetPhotos} captured and stored successfully.` });
        }
      } else {
        setMessage({ type: 'error', text: 'Failed to capture photo. Please ensure camera is working and try again.' });
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      setMessage({ type: 'error', text: 'Failed to store photo. Please try again.' });
    }
  };

  const registerStudent = async () => {
    if (photoCount < targetPhotos) {
      setMessage({ type: 'error', text: `Please capture at least ${targetPhotos} photos before registering.` });
      return;
    }

    setIsRegistering(true);
    setMessage({ type: 'info', text: 'Processing photos and extracting facial features using dlib...' });

    try {
      // Extract features from stored photos
      await faceRecognitionService.extractAndStoreFeatures(studentName, photoCount);
      
      setMessage({ 
        type: 'success', 
        text: `${studentName} has been successfully registered with ${photoCount} photos! Facial features extracted and stored.` 
      });
      
      // Reset form
      setStudentName('');
      setPhotoCount(0);
      setCapturedPhotos([]);
      stopCamera();
    } catch (error) {
      console.error('Registration error:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to register student. Please try again.' 
      });
    } finally {
      setIsRegistering(false);
    }
  };

  const resetCapture = () => {
    setPhotoCount(0);
    setCapturedPhotos([]);
    setMessage(null);
    if (isCapturing) {
      setMessage({ type: 'info', text: 'Photo count reset. Continue capturing photos.' });
    }
  };

  const getFaceDetectionStatus = () => {
    if (!isCapturing || !videoReady) return null;
    
    if (detectionResult.outOfRange) {
      return { type: 'warning', text: 'OUT OF RANGE - Move closer to camera', color: 'border-red-400' };
    }
    
    if (detectionResult.faceDetected) {
      return { type: 'success', text: 'FACE DETECTED - Ready to capture', color: 'border-green-400' };
    }
    
    return { type: 'info', text: 'Looking for face...', color: 'border-blue-400' };
  };

  const faceStatus = getFaceDetectionStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Register Students</h1>
        <p className="text-gray-600">
          Register new students by capturing multiple photos for facial recognition using dlib technology.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Student Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Information</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-2">
                Student Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter student's full name"
                  disabled={isCapturing}
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Photo Capture Progress</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Photos Captured</span>
                <span className="text-sm font-semibold text-gray-900">
                  {photoCount}/{targetPhotos}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(photoCount / targetPhotos) * 100}%` }}
                ></div>
              </div>
              {photoCount >= targetPhotos && (
                <div className="flex items-center mt-2 text-green-600">
                  <Check className="h-4 w-4 mr-1" />
                  <span className="text-sm">Ready to register!</span>
                </div>
              )}
            </div>

            {/* Face Detection Status */}
            {faceStatus && (
              <div className={`p-3 rounded-lg border-2 ${
                faceStatus.type === 'success' ? 'bg-green-50 border-green-200' :
                faceStatus.type === 'warning' ? 'bg-red-50 border-red-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center">
                  {faceStatus.type === 'success' && <Check className="h-4 w-4 mr-2 text-green-600" />}
                  {faceStatus.type === 'warning' && <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />}
                  {faceStatus.type === 'info' && <Camera className="h-4 w-4 mr-2 text-blue-600" />}
                  <span className={`text-sm font-medium ${
                    faceStatus.type === 'success' ? 'text-green-800' :
                    faceStatus.type === 'warning' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {faceStatus.text}
                  </span>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              {!isCapturing ? (
                <button
                  onClick={startCamera}
                  disabled={!studentName.trim() || cameraLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {cameraLoading ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Starting Camera...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Start Camera
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop Camera
                </button>
              )}
              
              <button
                onClick={resetCapture}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
            </div>

              <button
                onClick={handleCapturePhoto}
                disabled={!isCapturing || !videoReady || !stream || photoCount >= targetPhotos}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
              <Camera className="h-4 w-4 mr-2" />
              Capture Photo ({photoCount}/{targetPhotos})
            </button>

            <button
              onClick={registerStudent}
              disabled={!studentName.trim() || photoCount < targetPhotos || isRegistering}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isRegistering ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Processing with dlib...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Register Student
                </>
              )}
            </button>
          </div>
        </div>

        {/* Camera Feed */}
        <div className="bg-white rounded-lg shadow-sm p-6">
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
                  style={{ transform: 'scaleX(-1)' }} // Mirror the video
                />
                
                {/* Face detection overlay */}
                {detectionResult.faceDetected && detectionResult.boundingBox && (
                  <div
                    className={`absolute border-2 rounded animate-pulse ${faceStatus?.color || 'border-gray-400'}`}
                    style={{
                      left: `${100 - detectionResult.boundingBox.x - detectionResult.boundingBox.width}%`, // Mirror the overlay
                      top: `${detectionResult.boundingBox.y}%`,
                      width: `${detectionResult.boundingBox.width}%`,
                      height: `${detectionResult.boundingBox.height}%`,
                    }}
                  >
                    <div className={`absolute -top-6 left-0 px-2 py-1 rounded text-xs font-semibold ${
                      detectionResult.outOfRange 
                        ? 'bg-red-400 text-white' 
                        : 'bg-green-400 text-white'
                    }`}>
                      {detectionResult.outOfRange ? 'Out of Range' : 'Face Detected'}
                    </div>
                  </div>
                )}

                {(cameraLoading || !videoReady) && (
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
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Camera not active</p>
                  <p className="text-sm text-gray-400">Enter student name and click "Start Camera"</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
          message.type === 'warning' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' :
          'bg-blue-50 border border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' && <Check className="h-5 w-5 mr-2" />}
            {message.type === 'error' && <X className="h-5 w-5 mr-2" />}
            {message.type === 'warning' && <AlertTriangle className="h-5 w-5 mr-2" />}
            {message.type === 'info' && <Camera className="h-5 w-5 mr-2" />}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">Registration Instructions</h3>
        <div className="space-y-2 text-blue-800">
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">1</span>
            <span>Enter the student's full name in the form</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">2</span>
            <span>Click "Start Camera" to begin photo capture with dlib face detection</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">3</span>
            <span>Wait for "Face Detected" status (avoid "Out of Range")</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">4</span>
            <span>Click "Capture Photo" button 10 times from different angles</span>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">5</span>
            <span>Click "Register Student" to extract 128D features using dlib</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterStudents;