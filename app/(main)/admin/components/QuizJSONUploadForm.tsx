'use client';

import { useState, useRef } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface QuizJSONUploadFormProps {
  onUploadSuccess?: (result: any) => void;
  onUploadError?: (error: string) => void;
  supabase?: SupabaseClient;
}

export default function QuizJSONUploadForm({ onUploadSuccess, onUploadError, supabase }: QuizJSONUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCourseTitleFromFileName = (name: string) => {
    return name.replace(/\.json$/i, '').replace(/_Test$/i, '').trim();
  };

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
      if (!courseTitle) {
        setCourseTitle(parseCourseTitleFromFileName(selectedFile.name));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      alert('Vui lòng chọn file JSON.');
      return;
    }

    if (!supabase) {
      alert('Không khởi tạo được Supabase client.');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Bạn cần đăng nhập để sử dụng tính năng này.');
      }

      const formData = new FormData();
      formData.append('file', file);
      if (courseTitle) {
        formData.append('courseTitle', courseTitle);
      }
      if (courseId) {
        formData.append('courseId', courseId);
      }

      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/admin/process-quiz-json', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi xử lý JSON bài kiểm tra');
      }

      if (onUploadSuccess) {
        onUploadSuccess(data);
      }

      setFile(null);
      setCourseTitle('');
      setCourseId('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert(
        `Đã tạo bài kiểm tra cho khóa học "${data.course.title}".\n` +
        `- Số bài kiểm tra: ${data.statistics.quizzes}\n` +
        `- Tổng số câu hỏi: ${data.statistics.questions}`
      );
    } catch (error: any) {
      if (onUploadError) {
        onUploadError(error.message || 'Lỗi xử lý JSON bài kiểm tra');
      } else {
        alert(error.message || 'Lỗi xử lý JSON bài kiểm tra. Vui lòng thử lại.');
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
      </div>

      <div>
        <label htmlFor="courseTitle" className="block text-sm font-medium text-gray-700 mb-2">
          Tên khóa học (dùng để tìm khóa học đã tạo)
        </label>
        <input
          type="text"
          id="courseTitle"
          value={courseTitle}
          onChange={(e) => setCourseTitle(e.target.value)}
          disabled={uploading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
          placeholder="Ví dụ: Kỹ năng thuyết trình"
        />
      </div>

      <div>
        <label htmlFor="courseId" className="block text-sm font-medium text-gray-700 mb-2">
          ID khóa học (tùy chọn, ưu tiên nếu nhập)
        </label>
        <input
          type="text"
          id="courseId"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={uploading}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50"
          placeholder="Nhập ID khóa học nếu bạn đã biết"
        />
      </div>

      {uploading && (
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Đang xử lý JSON bài kiểm tra...</span>
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

      <button
        type="submit"
        disabled={uploading || !file}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading ? 'Đang xử lý...' : 'Upload bài kiểm tra JSON'}
      </button>
    </form>
  );
}
