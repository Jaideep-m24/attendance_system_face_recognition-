# Face Recognition Flask API

This Flask API provides face recognition functionality using dlib and OpenCV.

## Setup

1. **Install Python dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Download dlib models:**
   ```bash
   python download_models.py
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

4. **Run the Flask server:**
   ```bash
   python app.py
   ```

The API will be available at `http://localhost:5000`

## API Endpoints

- `GET /health` - Health check
- `POST /detect-face` - Detect faces in an image
- `POST /store-photo` - Store student photo
- `POST /extract-features` - Extract facial features from photos
- `POST /recognize-faces` - Recognize faces in group photo

## Requirements

- Python 3.8+
- dlib (requires CMake and Visual Studio Build Tools on Windows)
- OpenCV
- Flask
- Supabase Python client

## Models

The API uses two dlib models:
- `shape_predictor_68_face_landmarks.dat` - For facial landmark detection
- `dlib_face_recognition_resnet_model_v1.dat` - For 128D face feature extraction