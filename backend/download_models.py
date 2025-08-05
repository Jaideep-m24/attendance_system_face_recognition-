import os
import urllib.request
import gzip
import shutil

def download_file(url, filename):
    """Download a file from URL"""
    print(f"Downloading {filename}...")
    urllib.request.urlretrieve(url, filename)
    print(f"Downloaded {filename}")

def extract_gz(gz_filename, output_filename):
    """Extract .gz file"""
    print(f"Extracting {gz_filename}...")
    with gzip.open(gz_filename, 'rb') as f_in:
        with open(output_filename, 'wb') as f_out:
            shutil.copyfileobj(f_in, f_out)
    os.remove(gz_filename)
    print(f"Extracted to {output_filename}")

def main():
    # Create models directory
    os.makedirs('models', exist_ok=True)
    
    # Download shape predictor
    shape_predictor_url = "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
    shape_predictor_file = "models/shape_predictor_68_face_landmarks.dat.bz2"
    
    if not os.path.exists("models/shape_predictor_68_face_landmarks.dat"):
        download_file(shape_predictor_url, shape_predictor_file)
        
        # Extract bz2 file
        import bz2
        print("Extracting shape predictor...")
        with bz2.BZ2File(shape_predictor_file, 'rb') as f_in:
            with open("models/shape_predictor_68_face_landmarks.dat", 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        os.remove(shape_predictor_file)
        print("Shape predictor extracted")
    
    # Download face recognition model
    face_model_url = "http://dlib.net/files/dlib_face_recognition_resnet_model_v1.dat.bz2"
    face_model_file = "models/dlib_face_recognition_resnet_model_v1.dat.bz2"
    
    if not os.path.exists("models/dlib_face_recognition_resnet_model_v1.dat"):
        download_file(face_model_url, face_model_file)
        
        # Extract bz2 file
        print("Extracting face recognition model...")
        with bz2.BZ2File(face_model_file, 'rb') as f_in:
            with open("models/dlib_face_recognition_resnet_model_v1.dat", 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        os.remove(face_model_file)
        print("Face recognition model extracted")
    
    print("All models downloaded and extracted successfully!")

if __name__ == "__main__":
    main()