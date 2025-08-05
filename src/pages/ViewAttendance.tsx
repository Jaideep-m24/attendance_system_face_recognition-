import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Download, Search, Filter, Users, TrendingUp } from 'lucide-react';
import { useFaceRecognition } from '../services/faceRecognitionService';
import * as XLSX from 'xlsx';

interface AttendanceRecord {
  id: string;
  student_name: string;
  date: string;
  period: string;
  time: string;
  confidence: number;
  created_at: string;
}

const ViewAttendance: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setPeriod] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);

  const faceRecognitionService = useFaceRecognition();

  const periods = [
    { value: 'all', label: 'All Periods' },
    { value: '9-10 AM', label: '9-10 AM' },
    { value: '10-11 AM', label: '10-11 AM' },
    { value: '11-12 PM', label: '11-12 PM' },
    { value: '12-1 PM', label: '12-1 PM' },
    { value: '1-2 PM', label: '1-2 PM' },
    { value: '2-3 PM', label: '2-3 PM' },
    { value: '3-4 PM', label: '3-4 PM' },
    { value: '4-5 PM', label: '4-5 PM' },
  ];

  useEffect(() => {
    loadAttendanceData();
    loadTotalStudents();
  }, [selectedDate, selectedPeriod]);

  useEffect(() => {
    filterData();
  }, [attendanceData, searchTerm]);

  const loadTotalStudents = async () => {
    try {
      const count = await faceRecognitionService.getRegisteredStudentsCount();
      setTotalStudents(count);
    } catch (error) {
      console.error('Error loading students count:', error);
    }
  };

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const records = await faceRecognitionService.getAttendanceRecords(
        selectedDate, 
        selectedPeriod === 'all' ? undefined : selectedPeriod
      );
      setAttendanceData(records);
    } catch (error) {
      console.error('Error loading attendance data:', error);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = attendanceData;
    
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.student_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredData(filtered.sort((a, b) => a.student_name.localeCompare(b.student_name)));
  };

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      alert('No data to export for the selected filters.');
      return;
    }

    const exportData = filteredData.map(record => ({
      'Student Name': record.student_name,
      'Date': record.date,
      'Period': record.period,
      'Time': record.time,
      'Confidence': `${(record.confidence * 100).toFixed(1)}%`,
      'Recognition Method': 'dlib Face Recognition'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    const fileName = `attendance_${selectedDate}_${selectedPeriod !== 'all' ? selectedPeriod.replace(' ', '-') : 'all-periods'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const getAttendanceStats = () => {
    const uniqueStudents = new Set(filteredData.map(r => r.student_name)).size;
    const attendanceRate = totalStudents > 0 ? (uniqueStudents / totalStudents) * 100 : 0;
    
    return {
      totalPresent: uniqueStudents,
      totalStudents,
      attendanceRate: attendanceRate.toFixed(1)
    };
  };

  const stats = getAttendanceStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">View Attendance</h1>
        <p className="text-gray-600">
          View and export attendance records captured using dlib facial recognition technology.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-2">
              Select Period
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                id="period"
                value={selectedPeriod}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {periods.map(period => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Student
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                id="search"
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={exportToExcel}
              disabled={filteredData.length === 0 || loading}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Students Present</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalPresent}/{stats.totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.attendanceRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Filter className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Records Found</p>
              <p className="text-2xl font-semibold text-gray-900">{filteredData.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Attendance Records</h2>
          <p className="text-sm text-gray-600 mt-1">
            {loading ? 'Loading attendance records...' :
             filteredData.length > 0 
              ? `Showing ${filteredData.length} records for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} - Recognized using dlib`
              : 'No records found for the selected criteria'
            }
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {record.student_name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {record.student_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        record.confidence >= 0.9 
                          ? 'bg-green-100 text-green-800'
                          : record.confidence >= 0.85
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {(record.confidence * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Present
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Attendance Records</h3>
            <p className="text-gray-600 mb-4">
              No attendance records found for the selected date and period.
            </p>
            <p className="text-sm text-gray-500">
              Try adjusting your filters or check if attendance was taken for this period.
            </p>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">dlib Face Recognition Technology</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <h4 className="font-semibold mb-2">Recognition Features:</h4>
            <ul className="space-y-1">
              <li>• 128D facial feature extraction using dlib ResNet model</li>
              <li>• Confidence scores based on Euclidean distance matching</li>
              <li>• Real-time face detection and recognition</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Data Management:</h4>
            <ul className="space-y-1">
              <li>• Secure storage in Supabase database</li>
              <li>• Export capabilities with confidence metrics</li>
              <li>• Automatic duplicate prevention per period</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewAttendance;