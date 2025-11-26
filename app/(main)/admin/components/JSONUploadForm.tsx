'use client';

import { useState, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface JSONUploadFormProps {
  onUploadSuccess?: (result: any) => void;
  onUploadError?: (error: string) => void;
  supabase?: SupabaseClient;
}

export default function JSONUploadForm({ onUploadSuccess, onUploadError, supabase }: JSONUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [quizFile, setQuizFile] = useState<File | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseLevel, setCourseLevel] = useState('Beginner');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quizFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json' && !selectedFile.name.toLowerCase().endsWith('.json')) {
        alert('Vui lòng chọn file JSON.');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File quá lớn. Kích thước tối đa là 10MB.');
        return;
      }
      setFile(selectedFile);
      // Auto-fill course title from file name
      if (!courseTitle) {
        const fileName = selectedFile.name.replace(/\.json$/i, '');
        setCourseTitle(fileName);
      }
    }
  };

  const handleQuizFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/json' && !selectedFile.name.toLowerCase().endsWith('.json')) {
        alert('Vui lòng chọn file JSON bài kiểm tra.');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File bài kiểm tra quá lớn. Kích thước tối đa là 10MB.');
        return;
      }
      setQuizFile(selectedFile);
      // Nếu chưa có courseTitle, auto-fill từ tên file test (bỏ _Test nếu có)
      if (!courseTitle) {
        const baseName = selectedFile.name.replace(/\.json$/i, '').replace(/_Test$/i, '');
        setCourseTitle(baseName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert('Vui lòng chọn file JSON.');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // Get session token để gửi kèm request
      let sessionToken: string | null = null;
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          sessionToken = session.access_token;
        }
      }

      if (!sessionToken) {
        throw new Error('Bạn cần đăng nhập để sử dụng tính năng này.');
      }

      const formData = new FormData();
      formData.append('file', file);
      if (quizFile) {
        formData.append('quizFile', quizFile);
      }
      if (courseTitle) formData.append('courseTitle', courseTitle);
      if (courseDescription) formData.append('courseDescription', courseDescription);
      if (courseLevel) formData.append('courseLevel', courseLevel);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/admin/process-json', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi xử lý JSON');
      }

      if (onUploadSuccess) {
        onUploadSuccess(data);
      }

      // Reset form
      setFile(null);
      setQuizFile(null);
      setCourseTitle('');
      setCourseDescription('');
      setCourseLevel('Beginner');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (quizFileInputRef.current) {
        quizFileInputRef.current.value = '';
      }

      const stats = data.statistics || {};
      let message = `Khóa học "${data.course.title}" đã được tạo thành công!\n` +
        `- ${stats.modules} học phần\n` +
        `- ${stats.lessons} bài học`;

      if (typeof stats.quizzes === 'number' && typeof stats.questions === 'number') {
        message += `\n- ${stats.quizzes} bài kiểm tra (${stats.questions} câu hỏi)`;
      }

      alert(message);

    } catch (error: any) {
      console.error('Upload error:', error);
      if (onUploadError) {
        onUploadError(error.message || 'Lỗi xử lý JSON');
      } else {
        alert(error.message || 'Lỗi xử lý JSON. Vui lòng thử lại.');
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* File Upload */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          disabled={uploading}
          required
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-500">
          Chọn file JSON nội dung khóa học (từ thư mục <code className="bg-gray-100 px-1 rounded">documents/Courses</code>).
        </p>
      </div>

      {/* Optional Quiz File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          File JSON bài kiểm tra (tùy chọn)
        </label>
        <input
          ref={quizFileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleQuizFileChange}
          disabled={uploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-500">
          Nếu chọn, hệ thống sẽ tự động tạo bài kiểm tra theo chương cho khóa học này (từ thư mục <code className="bg-gray-100 px-1 rounded">documents/Test</code> với tên file giống nội dung khóa học).
        </p>
      </div>

      {/* Course Title */}
      <div>
        <label htmlFor="courseTitle" className="block text-sm font-medium text-gray-700 mb-2">
          Tên khóa học
        </label>
        <input
          type="text"
          id="courseTitle"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          required
          disabled={uploading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
          placeholder="Nhập tên khóa học"
        />
      </div>

      {/* Course Description */}
      <div>
        <label htmlFor="courseDescription" className="block text-sm font-medium text-gray-700 mb-2">
          Mô tả khóa học
        </label>
        <textarea
          id="courseDescription"
          value={courseDescription}
          onChange={(e) => setCourseDescription(e.target.value)}
          disabled={uploading}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
          placeholder="Nhập mô tả khóa học (tùy chọn)"
        />
      </div>

      {/* Course Level */}
      <div>
        <label htmlFor="courseLevel" className="block text-sm font-medium text-gray-700 mb-2">
          Cấp độ
        </label>
        <select
          id="courseLevel"
          value={courseLevel}
          onChange={(e) => setCourseLevel(e.target.value)}
          disabled={uploading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
        >
          <option value="Beginner">Cơ bản</option>
          <option value="Intermediate">Trung bình</option>
          <option value="Advanced">Nâng cao</option>
        </select>
      </div>

      {/* Progress Bar */}
      {uploading && (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Đang xử lý JSON...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-teal-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={uploading || !file}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? 'Đang xử lý...' : 'Upload và tạo khóa học'}
      </button>
    </form>
  );
}

