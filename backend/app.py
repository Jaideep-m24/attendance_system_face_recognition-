import os
import cv2
import dlib
import numpy as np
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
import tempfile
import logging
from datetime import datetime, date
import uuid
from PIL import Image
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize Supabase client
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://bgncsfhcisjgeivuidtb.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnbmNzZmhjaXNqZ2VpdnVpZHRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDE0ODE5MywiZXhwIjoyMDY1NzI0MTkzfQ.DL5ui--BsLKULJ7CvxINpfdEK2GHe3dusnHy5SNUbuM')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Initialize dlib models
try:
    detector = dlib.get_frontal_face_detector()
    predictor = dlib.shape_predictor('models/shape_predictor_68_face_landmarks.dat')
    face_reco_model = dlib.face_recognition_model_v1('models/dlib_face_recognition_resnet_model_v1.dat')
    logger.info("dlib models loaded successfully")
except Exception as e:
    logger.error(f"Error loading dlib models: {e}")
    detector = None
    predictor = None
    face_reco_model = None

def bytes_to_opencv_image(img_bytes: bytes):
    """Decode bytes into a uint8 BGR image (always 3 channels)."""
    try:
        arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)  # keep alpha if present
        if img is None:
            return None
        # force uint8
        if img.dtype != np.uint8:
            img = img.astype(np.uint8)
        # ensure 3-channel BGR
        if len(img.shape) == 2:  # grayscale -> BGR
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif img.shape[2] == 4:  # BGRA -> BGR
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        return np.ascontiguousarray(img)
    except Exception as e:
        logger.error(f"bytes_to_opencv_image error: {e}")
        return None

def base64_to_image(base64_string):
    """Convert base64 (data URL or raw) to uint8 BGR image (3 channels)."""
    try:
        if ',' in base64_string:  # strip data URL header if present
            base64_string = base64_string.split(',', 1)[1]
        img_bytes = base64.b64decode(base64_string)
        return bytes_to_opencv_image(img_bytes)
    except Exception as e:
        logger.error(f"Error converting base64 to image: {e}")
        return None


def extract_face_features(image):
    """Extract 128D face features using dlib"""
    if detector is None or predictor is None or face_reco_model is None:
        raise Exception("dlib models not loaded")
    
    try:
        # Normalize for OpenCV & dlib
        if image.dtype != np.uint8:
            image = image.astype(np.uint8)
        image = np.ascontiguousarray(image)

        # OpenCV detector uses gray from BGR
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # dlib descriptor expects RGB (uint8, 3ch)
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Detect & describe
        faces = detector(gray)
        if len(faces) == 0:
            return None, None

        face = faces[0]
        landmarks = predictor(gray, face)
        face_descriptor = face_reco_model.compute_face_descriptor(rgb, landmarks)

        # Convert to numpy array
        features = np.array(face_descriptor)
        
        # Get bounding box coordinates
        bbox = {
            'x': int(face.left()),
            'y': int(face.top()),
            'width': int(face.width()),
            'height': int(face.height())
        }
        
        return features, bbox
    except Exception as e:
        logger.error(f"Error extracting face features: {e}")
        return None, None

def calculate_face_distance(features1, features2):
    """Calculate Euclidean distance between two face feature vectors"""
    return np.linalg.norm(features1 - features2)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'dlib_loaded': detector is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/detect-face', methods=['POST'])
def detect_face():
    """Detect faces in an image"""
    try:
        data = request.get_json()
        image_data = data.get('image')
        
        if not image_data:
            return jsonify({'error': 'No image data provided'}), 400
        
        # Convert base64 to image
        image = base64_to_image(image_data)
        if image is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        # Detect faces
        if detector is None:
            return jsonify({'error': 'Face detector not loaded'}), 500
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = detector(gray)
        
        face_detected = len(faces) > 0
        face_count = len(faces)
        
        result = {
            'faceDetected': face_detected,
            'faceCount': face_count
        }
        
        if face_detected:
            face = faces[0]
            # Convert to percentage coordinates
            height, width = image.shape[:2]
            
            bbox = {
                'x': (face.left() / width) * 100,
                'y': (face.top() / height) * 100,
                'width': (face.width() / width) * 100,
                'height': (face.height() / height) * 100
            }
            
            # Check if face is out of range (too close to edges)
            out_of_range = (
                bbox['x'] < 10 or bbox['y'] < 10 or 
                bbox['x'] + bbox['width'] > 90 or 
                bbox['y'] + bbox['height'] > 90
            )
            
            result['boundingBox'] = bbox
            result['outOfRange'] = out_of_range
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in detect_face: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/store-photo', methods=['POST'])
def store_photo():
    """Store student photo in Supabase Storage"""
    try:
        data = request.get_json()
        student_name = data.get('studentName')
        image_data = data.get('imageData')
        photo_index = data.get('photoIndex')
        
        if not all([student_name, image_data, photo_index]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Convert base64 to bytes
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        
       # Create file path (one slot per index)
        file_path = f"students/{student_name}/photo_{photo_index}.jpg"
        
       # Upload to Supabase Storage and get the raw HTTP response
        response = supabase.storage.from_('student-photos').upload(
            file_path,
            image_bytes,
        )

        # Parse the JSON body
        result = response.json()

        # If Supabase returned an error status, surface it
        if response.status_code >= 400:
            logger.error(f"Error storing photo: {result}")
            return jsonify({'error': result}), response.status_code

        # On success, Supabase returns { Key: 'students/Name/photo_1.jpg', ... }
        file_key = result.get('Key') or result.get('key')
        return jsonify({'success': True, 'filePath': file_key})
        
    except Exception as e:
        logger.error(f"Error storing photo: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/extract-features', methods=['POST'])
def extract_features():
    """Extract facial features from stored photos"""
    try:
        data = request.get_json()
        student_name = data.get('studentName')
        photo_count = data.get('photoCount')
        
        if not all([student_name, photo_count]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        logger.info(f"Extracting features for {student_name} with {photo_count} photos")
        
        # Get list of photos from Supabase Storage (returns a Python list)
        photos = supabase.storage.from_('student-photos').list(f"students/{student_name}")
        if not isinstance(photos, list):
         raise Exception("Error listing photos for student")
        if len(photos) == 0:
         raise Exception("No photos found for student")
        
        # Extract features from each photo
        all_features = []
        valid_photos = 0
        
        for photo in photos:
            try:
               # Download photo from storage (returns raw bytes)
                photo_bytes = supabase.storage.from_('student-photos').download(
                    f"students/{student_name}/{photo['name']}"
               )
                if not isinstance(photo_bytes, (bytes, bytearray)):
                    logger.warning(f"Unexpected download result for {photo['name']}: {type(photo_bytes)}")
                    continue
                # Decode the image bytes into an OpenCV array
                image_array = np.frombuffer(photo_bytes, np.uint8)
                image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                
                if image is None:
                    logger.warning(f"Could not decode image {photo['name']}")
                    continue
                
                # Extract features
                features, bbox = extract_face_features(image)
                
                if features is not None:
                    all_features.append(features)
                    valid_photos += 1
                    logger.info(f"Extracted features from {photo['name']}")
                else:
                    logger.warning(f"No face detected in {photo['name']}")
                    
            except Exception as e:
                logger.error(f"Error processing {photo['name']}: {e}")
                continue
        
        if len(all_features) == 0:
            raise Exception("No valid face features could be extracted")
        
        # Calculate mean features
        mean_features = np.mean(all_features, axis=0)
        
        student_response = supabase.table('students').upsert({
       'name': student_name,
       'folder_path': f"students/{student_name}",
       'photo_count': photo_count
       }).execute()

        # On failure .data is a dict with "message"
        if isinstance(student_response.data, dict) and student_response.data.get("message"):
         raise Exception(f"Error storing student: {student_response.data['message']}")

        student_id = student_response.data[0]['id']
        
        # Store features in database
        features_response = supabase.table('student_features').upsert({
            'student_id': student_id,
            'student_name': student_name,
           'features': mean_features.tolist()
        }).execute()

        # Likewise, use .error here  
        if isinstance(features_response.data, dict) and features_response.data.get("message"):
         raise Exception(f"Error storing features: {features_response.data['message']}")
        
        logger.info(f"Successfully extracted and stored features for {student_name}")
        
        return jsonify({
            'success': True,
            'message': f'Features extracted and stored for {student_name}',
            'validPhotos': valid_photos,
            'totalPhotos': len(photos),
            'featuresCount': len(mean_features)
        })
        
    except Exception as e:
        logger.error(f"Error in extract_features: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/recognize-faces', methods=['POST'])
def recognize_faces():
    """Recognize faces in a group photo"""
    try:
        data = request.get_json()
        group_image_data = data.get('groupImage')
        period = data.get('period')
        
        if not all([group_image_data, period]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        logger.info(f"Processing group image for period: {period}")
        
        # Convert base64 to image
        image = base64_to_image(group_image_data)
        if image is None:
            return jsonify({'error': 'Invalid image data'}), 400

        # Safety: dtype/contiguity
        if image.dtype != np.uint8:
           image = image.astype(np.uint8)
           image = np.ascontiguousarray(image)

        
        # Get all registered students and their features
        features_response = supabase.table('student_features').select('student_name, features').execute()
        
        if isinstance(features_response.data, dict) and features_response.data.get("message"):
         raise Exception(f"Error fetching student features: {features_response.data['message']}")
        
        registered_students = features_response.data
        if not registered_students:
            return jsonify({
                'success': True,
                'recognizedStudents': [],
                'message': 'No registered students found'
            })
        
        # Detect faces in group image
        if detector is None:
            raise Exception("Face detector not loaded")
        
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        rgb  = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        faces = detector(gray)
        
        logger.info(f"Detected {len(faces)} faces in group image")
        
        recognized_students = []
        height, width = image.shape[:2]
        
        # Process each detected face
        for face in faces:
            try:
                # Extract features from detected face
                landmarks = predictor(gray, face)
                face_descriptor = face_reco_model.compute_face_descriptor(rgb, landmarks)
                face_features = np.array(face_descriptor)
                
                # Find best match among registered students
                best_match = None
                best_distance = float('inf')
                
                for student in registered_students:
                    student_features = np.array(student['features'])
                    distance = calculate_face_distance(face_features, student_features)
                    
                    if distance < best_distance:
                        best_distance = distance
                        best_match = student
                
                # Check if match is good enough (threshold from Python code)
                if best_match and best_distance < 0.4:
                    confidence = 1 - (best_distance / 0.4)  # Convert distance to confidence
                    
                    # Convert face coordinates to percentages
                    bbox = {
                        'x': (face.left() / width) * 100,
                        'y': (face.top() / height) * 100,
                        'width': (face.width() / width) * 100,
                        'height': (face.height() / height) * 100
                    }
                    
                    recognized_students.append({
                        'name': best_match['student_name'],
                        'confidence': confidence,
                        'position': bbox
                    })
                    
                    logger.info(f"Recognized {best_match['student_name']} with confidence {confidence:.2f}")
                
            except Exception as e:
                logger.error(f"Error processing face: {e}")
                continue
        
        # Store attendance records
        current_date = date.today().isoformat()
        current_time = datetime.now().strftime('%H:%M:%S')
        
        attendance_records = []
        for student in recognized_students:
            attendance_records.append({
                'student_name': student['name'],
                'confidence': student['confidence'],
                'period': period,
                #'date': current_date,
                #'time': current_time
            })
        
        if attendance_records:
            attendance_response = supabase.table('attendance_records').upsert(
                attendance_records,
                on_conflict='student_name,period'
            ).execute()
            
            if isinstance(attendance_response.data, dict) and attendance_response.data.get("message"):
             logger.error(f"Error storing attendance: {attendance_response.data['message']}")
        
             logger.info(f"Recognized {len(recognized_students)} students")
        
        return jsonify({
            'success': True,
            'recognizedStudents': recognized_students,
            'attendanceCount': len(recognized_students),
            'period': period,
            'facesDetected': len(faces)
        })
        
    except Exception as e:
        logger.error(f"Error in recognize_faces: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
