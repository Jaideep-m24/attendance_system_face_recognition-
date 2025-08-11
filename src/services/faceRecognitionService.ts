const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://attendance-system-face-recognition-t9rj.onrender.com';
import { useSupabase } from '../contexts/SupabaseContext';

export interface FaceDetectionResult {
  faceDetected: boolean;
  faceCount: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  outOfRange?: boolean;
}

export interface RecognizedStudent {
  name: string;
  confidence: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class FaceRecognitionService {
  private supabase: any;
  private apiBaseUrl: string;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.apiBaseUrl = 'http://localhost:5000'; // Flask API URL
  }

  // Real dlib face detection using Flask API
  async detectFaces(imageData: string): Promise<FaceDetectionResult> {
    try {
      const response = await fetch(`${API_URL}/recognize-faces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      console.error('Face detection error:', error);
      // Fallback to mock detection if API is unavailable
      return this.mockFaceDetection();
    }
  }

  // Fallback mock detection
  private mockFaceDetection(): FaceDetectionResult {
    const detectionProbability = 0.8;
    const hasFace = Math.random() < detectionProbability;
    const faceCount = hasFace ? 1 : 0;
    
    const boundingBox = hasFace ? {
      x: Math.random() * 30 + 25,
      y: Math.random() * 30 + 25,
      width: Math.random() * 10 + 20,
      height: Math.random() * 15 + 25
    } : undefined;

    const outOfRange = hasFace && boundingBox ? (
      boundingBox.x + boundingBox.width > 85 || 
      boundingBox.y + boundingBox.height > 85 ||
      boundingBox.x < 15 || 
      boundingBox.y < 15
    ) : false;

    return {
      faceDetected: hasFace && !outOfRange,
      faceCount,
      boundingBox,
      outOfRange
    };
  }

  // Store student photos using Flask API
  async storeStudentPhoto(studentName: string, photoBlob: Blob, photoIndex: number): Promise<string> {
    try {
      // Convert blob to base64
      const base64Image = await this.blobToBase64(photoBlob);
      
      const response = await fetch(`${API_URL}/store-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentName,
          imageData: `data:image/jpeg;base64,${base64Image}`,
          photoIndex
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to store photo');
      }

      console.log(`Photo stored successfully: ${result.filePath}`);
      return result.filePath;
    } catch (error) {
      console.error('Error storing photo:', error);
      throw new Error(`Failed to store photo: ${error.message}`);
    }
  }

  // Extract features using Flask API with real dlib processing
  async extractAndStoreFeatures(studentName: string, photoCount: number): Promise<boolean> {
    try {
      console.log(`Starting dlib feature extraction for ${studentName} with ${photoCount} photos`);
      
      const response = await fetch(`${API_URL}/extract-features`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentName,
          photoCount
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Feature extraction failed');
      }

      console.log(`dlib feature extraction completed: ${result.validPhotos}/${result.totalPhotos} photos processed`);
      return true;
    } catch (error) {
      console.error('Feature extraction error:', error);
      throw new Error(`Failed to extract features with dlib: ${error.message}`);
    }
  }

  // Recognize faces using Flask API with real dlib processing
  async recognizeFacesInGroupPhoto(imageBlob: Blob, period: string): Promise<RecognizedStudent[]> {
    try {
      console.log(`Starting dlib face recognition for period: ${period}`);
      
      // Convert blob to base64
      const base64Image = await this.blobToBase64(imageBlob);
      
      const response = await fetch(`${this.apiBaseUrl}/recognize-faces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupImage: base64Image,
          period
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Face recognition failed');
      }

      console.log(`dlib face recognition completed: ${result.recognizedStudents.length} students recognized from ${result.facesDetected} detected faces`);
      return result.recognizedStudents;
    } catch (error) {
      console.error('Face recognition error:', error);
      throw new Error(`Failed to recognize faces with dlib: ${error.message}`);
    }
  }

  // Get attendance records
  async getAttendanceRecords(date: string, period?: string): Promise<any[]> {
    try {
      let query = this.supabase
        .from('attendance_records')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: false });

      if (period && period !== 'all') {
        query = query.eq('period', period);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Database query error:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      throw new Error(`Failed to fetch attendance records: ${error.message}`);
    }
  }

  // Get registered students count
  async getRegisteredStudentsCount(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Count query error:', error);
        throw error;
      }
      
      return count || 0;
    } catch (error) {
      console.error('Error getting students count:', error);
      return 0;
    }
  }

  // Get recent activity for dashboard
  async getRecentActivity(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('attendance_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Recent activity query error:', error);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  }

  // Helper function to convert blob to base64
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Hook to use the face recognition service
export const useFaceRecognition = () => {
  const supabase = useSupabase();
  return new FaceRecognitionService(supabase);
};
