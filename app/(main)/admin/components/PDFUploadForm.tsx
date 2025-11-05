'use client';

import { useState, useRef } from 'react';

interface PDFUploadFormProps {
  onUploadSuccess?: (result: any) => void;
  onUploadError?: (error: string) => void;
}

export default function PDFUploadForm({ onUploadSuccess, onUploadError }: PDFUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseLevel, setCourseLevel] = useState('Beginner');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        alert('Vui lòng chọn file PDF.');
        return;
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        alert('File quá lớn. Kích thước tối đa là 50MB.');
        return;
      }
      setFile(selectedFile);
      // Auto-fill course title from file name
      if (!courseTitle) {
        const fileName = selectedFile.name.replace(/\.pdf$/i, '');
        setCourseTitle(fileName);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    alert('Chế độ batch-only JSON đang bật. Upload PDF tạm thời không khả dụng. Vui lòng dùng batch JSON trong documents/.');
    return;

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (courseTitle) formData.append('courseTitle', courseTitle);
      if (courseDescription) formData.append('courseDescription', courseDescription);
      if (courseLevel) formData.append('courseLevel', courseLevel);

      // Simulate progress (PDF processing is complex, so we simulate)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 1000);

      const response = await fetch('/api/admin/process-pdf', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi xử lý PDF');
      }

      if (onUploadSuccess) {
        onUploadSuccess(data);
      }

      // Reset form
      setFile(null);
      setCourseTitle('');
      setCourseDescription('');
      setCourseLevel('Beginner');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      alert(`Khóa học "${data.course.title}" đã được tạo thành công!\n` +
            `- ${data.statistics.modules} học phần\n` +
            `- ${data.statistics.lessons} bài học`);

    } catch (error: any) {
      console.error('Upload error:', error);
      if (onUploadError) {
        onUploadError(error.message || 'Lỗi xử lý PDF');
      } else {
        alert(error.message || 'Lỗi xử lý PDF. Vui lòng thử lại.');
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chọn file PDF (đã deprecate – dùng batch JSON)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          disabled
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-50"
        />
        <p className="mt-2 text-sm text-gray-500">Upload PDF tạm thời không khả dụng. Hãy đặt các file JSON vào documents/ và dùng chức năng batch.</p>
      </div>

      {/* Course Title */}
      <div>
        <label htmlFor="courseTitle" className="block text-sm font-medium text-gray-700 mb-2">
          Tên khóa học *
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
            <span>Đang xử lý PDF...</span>
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
        disabled
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {'Upload PDF đã deprecate'}
      </button>
    </form>
  );
}

