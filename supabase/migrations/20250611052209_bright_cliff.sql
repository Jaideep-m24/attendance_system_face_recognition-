/*
  # Face Recognition Database Schema

  1. New Tables
    - `students`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `folder_path` (text)
      - `photo_count` (integer)
      - `created_at` (timestamp)
    
    - `student_features`
      - `id` (uuid, primary key) 
      - `student_id` (uuid, foreign key)
      - `student_name` (text)
      - `features` (real array[128])
      - `created_at` (timestamp)
    
    - `attendance_records`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key)
      - `student_name` (text)
      - `confidence` (real)
      - `period` (text)
      - `date` (date)
      - `time` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
*/

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  folder_path text,
  photo_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage students"
  ON students
  FOR ALL
  TO authenticated
  USING (true);

-- Student features table
CREATE TABLE IF NOT EXISTS student_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  features real[128] NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE student_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage student features"
  ON student_features
  FOR ALL
  TO authenticated
  USING (true);

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  confidence real NOT NULL,
  period text NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_name, date, period)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage attendance records"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_student_features_student_id ON student_features(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date_period ON attendance_records(date, period);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_name ON attendance_records(student_name);