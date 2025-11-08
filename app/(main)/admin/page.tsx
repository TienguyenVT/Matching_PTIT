'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ROUTES } from '@/lib/routes';
import JSONUploadForm from './components/JSONUploadForm';

interface BatchProcessResult {
  success: boolean;
  summary?: {
    totalFiles: number;
    successCount: number;
    failureCount: number;
    totalModules: number;
    totalLessons: number;
  };
  results?: Array<{
    fileName: string;
    success: boolean;
    courseId?: string;
    courseTitle?: string;
    error?: string;
    statistics?: {
      modules: number;
      lessons: number;
      totalPages?: number;
    };
  }>;
  error?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchProcessResult | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        router.replace(ROUTES.LOGIN);
        return;
      }
      
      setUser(user);
      setLoading(false);
    };
    
    checkAuth();
  }, [supabase, router]);

  // Poll progress khi có progressId
  useEffect(() => {
    if (!progressId || !batchProcessing) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/batch-progress/${progressId}`);
        if (response.ok) {
          const progressData = await response.json();
          setProgress(progressData);

          // Nếu hoàn thành hoặc lỗi, dừng polling
          if (progressData.status === 'completed' || progressData.status === 'error') {
            clearInterval(pollInterval);
            setBatchProcessing(false);

            // Convert progress to batch result format
            if (progressData.status === 'completed') {
              const summary = {
                totalFiles: progressData.totalFiles,
                successCount: progressData.successCount,
                failureCount: progressData.failureCount,
                totalModules: progressData.results
                  .filter((r: any) => r.success && r.statistics)
                  .reduce((sum: number, r: any) => sum + (r.statistics?.modules || 0), 0),
                totalLessons: progressData.results
                  .filter((r: any) => r.success && r.statistics)
                  .reduce((sum: number, r: any) => sum + (r.statistics?.lessons || 0), 0)
              };

              setBatchResult({
                success: true,
                summary,
                results: progressData.results
              });

              alert(
                `Xử lý batch hoàn tất!\n` +
                `- Tổng số file: ${summary.totalFiles}\n` +
                `- Thành công: ${summary.successCount}\n` +
                `- Thất bại: ${summary.failureCount}\n` +
                `- Tổng học phần: ${summary.totalModules}\n` +
                `- Tổng bài học: ${summary.totalLessons}`
              );
            } else {
              setBatchResult({
                success: false,
                error: progressData.error || 'Lỗi xử lý batch'
              });
            }
          }
        }
      } catch (error) {
        console.error('Error polling progress:', error);
      }
    }, 1000); // Poll mỗi giây

    return () => clearInterval(pollInterval);
  }, [progressId, batchProcessing]);

  const handleBatchProcess = async () => {
    if (!confirm('Bạn có chắc muốn xử lý tất cả JSON trong folder documents/? Quá trình này có thể mất nhiều thời gian.')) {
      return;
    }

    setBatchProcessing(true);
    setBatchResult(null);
    setProgress(null);
    setProgressId(null);

    try {
      // Get session token để gửi kèm request
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Bạn cần đăng nhập để sử dụng tính năng này.');
        router.replace(ROUTES.LOGIN);
        return;
      }

      const response = await fetch('/api/admin/batch-process-pdfs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Lỗi xử lý batch');
      }

      // Lưu progressId để bắt đầu polling
      if (data.progressId) {
        setProgressId(data.progressId);
      } else {
        // Fallback nếu không có progressId (legacy response)
        setBatchResult(data);
        setBatchProcessing(false);
        if (data.summary) {
          alert(
            `Xử lý batch hoàn tất!\n` +
            `- Tổng số file: ${data.summary.totalFiles}\n` +
            `- Thành công: ${data.summary.successCount}\n` +
            `- Thất bại: ${data.summary.failureCount}\n` +
            `- Tổng học phần: ${data.summary.totalModules}\n` +
            `- Tổng bài học: ${data.summary.totalLessons}`
          );
        }
      }

    } catch (error: any) {
      console.error('Batch process error:', error);
      setBatchResult({
        success: false,
        error: error.message || 'Lỗi xử lý batch'
      });
      alert(error.message || 'Lỗi xử lý batch. Vui lòng thử lại.');
      setBatchProcessing(false);
    }
  };

  const handleUploadSuccess = (result: any) => {
    console.log('Upload success:', result);
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-teal-500 rounded"></div>
          <h1 className="text-2xl font-semibold text-gray-800">Quản trị hệ thống</h1>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-800">Tải lên và xử lý JSON</h2>
        </div>
        <JSONUploadForm
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          supabase={supabase}
        />
      </div>

      {/* Batch Process Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-800">Xử lý batch từ folder documents</h2>
        </div>
        <button
          onClick={handleBatchProcess}
          disabled={batchProcessing}
          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {batchProcessing ? 'Đang xử lý...' : 'Xử lý batch (JSON)'}
        </button>

        {/* Progress Bar */}
        {batchProcessing && progress && (
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>
                  Đang xử lý: {progress.currentFileName || 'Đang khởi động...'}
                </span>
                <span>
                  {progress.currentFile > 0 ? `${progress.currentFile}/${progress.totalFiles}` : `0/${progress.totalFiles}`} file
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${progress.totalFiles > 0 ? (progress.processedFiles / progress.totalFiles) * 100 : 0}%` 
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 text-center mt-1">
                {progress.totalFiles > 0 ? Math.round((progress.processedFiles / progress.totalFiles) * 100) : 0}%
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>
                  Đã xử lý: {progress.processedFiles}/{progress.totalFiles}
                </span>
                <span>
                  Thành công: {progress.successCount} | Thất bại: {progress.failureCount}
                </span>
              </div>
            </div>

            {/* Current File Progress */}
            {progress.currentFileName && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <p className="text-sm text-blue-800">
                    Đang xử lý: <span className="font-medium">{progress.currentFileName}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Processed Files List */}
            {progress.results && progress.results.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                <h4 className="font-medium text-gray-700 mb-2 text-sm">Các file đã xử lý:</h4>
                <div className="space-y-2">
                  {progress.results.map((result: any, index: number) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm ${
                        result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.fileName}</span>
                        {result.success ? (
                          <span className="text-xs">✅</span>
                        ) : (
                          <span className="text-xs">❌</span>
                        )}
                      </div>
                      {result.success && result.statistics && (
                        <p className="text-xs mt-1 opacity-75">
                          {result.statistics.modules} học phần, {result.statistics.lessons} bài học
                        </p>
                      )}
                      {!result.success && result.error && (
                        <p className="text-xs mt-1 opacity-75">{result.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Batch Result */}
        {batchResult && !batchProcessing && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-3">Kết quả xử lý batch</h3>
            {batchResult.success && batchResult.summary ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Tổng số file:</span> {batchResult.summary.totalFiles}</p>
                <p><span className="font-medium">Thành công:</span> <span className="text-green-600">{batchResult.summary.successCount}</span></p>
                <p><span className="font-medium">Thất bại:</span> <span className="text-red-600">{batchResult.summary.failureCount}</span></p>
                <p><span className="font-medium">Tổng học phần:</span> {batchResult.summary.totalModules}</p>
                <p><span className="font-medium">Tổng bài học:</span> {batchResult.summary.totalLessons}</p>
              </div>
            ) : (
              <p className="text-red-600 text-sm">{batchResult.error}</p>
            )}

            {/* Detailed Results */}
            {batchResult.results && batchResult.results.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Chi tiết:</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {batchResult.results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm ${
                        result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                      }`}
                    >
                      <p className="font-medium">{result.fileName}</p>
                      {result.success ? (
                        <p className="text-xs mt-1">
                          ✅ Khóa học: {result.courseTitle} ({result.statistics?.modules} học phần, {result.statistics?.lessons} bài học)
                        </p>
                      ) : (
                        <p className="text-xs mt-1">❌ {result.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Lưu ý:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Upload file JSON trực tiếp hoặc sử dụng batch processing từ folder documents/</li>
              <li>File JSON phải có cấu trúc Chương/Mục với format: <code className="bg-blue-100 px-1 rounded">{"{ \"data\": [...] }"}</code></li>
              <li>Hệ thống sẽ tự động tạo khóa học, học phần và bài học từ nội dung JSON</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

