import React, { useState, useEffect } from 'react';
import { Users, Camera, ClipboardList, TrendingUp, Calendar, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFaceRecognition } from '../services/faceRecognitionService';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayAttendance: 0,
    currentPeriod: '',
    attendanceRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const faceRecognitionService = useFaceRecognition();

  useEffect(() => {
    loadDashboardData();
  }, []);

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

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get total students count
      const totalStudents = await faceRecognitionService.getRegisteredStudentsCount();
      
      // Get today's attendance
      const today = new Date().toISOString().split('T')[0];
      const todayRecords = await faceRecognitionService.getAttendanceRecords(today);
      const uniqueStudentsToday = new Set(todayRecords.map(r => r.student_name)).size;
      
      // Calculate attendance rate
      const attendanceRate = totalStudents > 0 ? (uniqueStudentsToday / totalStudents) * 100 : 0;
      
      // Get recent activity (last 10 records)
      const recentRecords = await faceRecognitionService.getRecentActivity();
      
      setStats({
        totalStudents,
        todayAttendance: uniqueStudentsToday,
        currentPeriod: getCurrentPeriod(),
        attendanceRate: Math.round(attendanceRate)
      });
      
      setRecentActivity(recentRecords);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Set default values on error
      setStats({
        totalStudents: 0,
        todayAttendance: 0,
        currentPeriod: getCurrentPeriod(),
        attendanceRate: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Register New Student',
      description: 'Add a new student with photo capture',
      icon: Users,
      link: '/register-students',
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      title: 'Take Attendance',
      description: 'Capture group photo for attendance',
      icon: Camera,
      link: '/take-attendance',
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600'
    },
    {
      title: 'View Reports',
      description: 'Check attendance records and export',
      icon: ClipboardList,
      link: '/view-attendance',
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="animate-pulse">
                <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back! Here's your attendance overview.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Today's Date</div>
            <div className="text-lg font-semibold text-gray-900">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalStudents}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Attendance</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.todayAttendance}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Period</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.currentPeriod}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.attendanceRate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Link
                key={index}
                to={action.link}
                className="group p-6 border-2 border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center mb-4">
                  <div className={`p-3 rounded-lg ${action.color} ${action.hoverColor} transition-colors`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-gray-900 group-hover:text-gray-700">
                    {action.title}
                  </h3>
                </div>
                <p className="text-gray-600 group-hover:text-gray-500">
                  {action.description}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center p-4 bg-green-50 rounded-lg">
                <div className="p-2 bg-green-100 rounded-full">
                  <Camera className="h-4 w-4 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.student_name} marked present for {activity.period}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(activity.confidence * 100).toFixed(1)}% confidence • {activity.time} • {new Date(activity.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No recent activity</p>
              <p className="text-gray-400 text-xs">Start taking attendance to see activity here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;