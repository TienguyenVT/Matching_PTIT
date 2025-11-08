/**
 * Service quản lý progress cho batch processing
 * Lưu progress trong memory (có thể migrate sang Redis sau)
 */

interface BatchProgress {
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentFile: number;
  totalFiles: number;
  currentFileName: string;
  processedFiles: number;
  successCount: number;
  failureCount: number;
  results: Array<{
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

// Store progress in memory (keyed by user ID + timestamp)
const progressStore = new Map<string, BatchProgress>();

/**
 * Tạo progress ID cho user
 */
export function createProgressId(userId: string): string {
  return `${userId}_${Date.now()}`;
}

/**
 * Lưu progress
 */
export function setProgress(progressId: string, progress: Partial<BatchProgress>): void {
  const existing = progressStore.get(progressId);
  if (existing) {
    progressStore.set(progressId, { ...existing, ...progress });
  } else {
    progressStore.set(progressId, {
      status: 'pending',
      currentFile: 0,
      totalFiles: 0,
      currentFileName: '',
      processedFiles: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      ...progress,
    });
  }
}

/**
 * Lấy progress
 */
export function getProgress(progressId: string): BatchProgress | null {
  return progressStore.get(progressId) || null;
}

/**
 * Xóa progress cũ (cleanup)
 */
export function cleanupOldProgress(maxAge: number = 3600000): void {
  // Cleanup progress older than maxAge (default 1 hour)
  const now = Date.now();
  for (const [key, progress] of progressStore.entries()) {
    const timestamp = parseInt(key.split('_').pop() || '0');
    if (now - timestamp > maxAge) {
      progressStore.delete(key);
    }
  }
}

/**
 * Initialize progress
 */
export function initProgress(progressId: string, totalFiles: number): void {
  setProgress(progressId, {
    status: 'processing',
    totalFiles,
    currentFile: 0,
    currentFileName: '',
    processedFiles: 0,
    successCount: 0,
    failureCount: 0,
    results: [],
  });
}

/**
 * Update progress khi xử lý file
 */
export function updateFileProgress(
  progressId: string,
  currentFile: number,
  fileName: string,
  result?: BatchProgress['results'][0]
): void {
  const existing = getProgress(progressId);
  if (!existing) return;

  const updates: Partial<BatchProgress> = {
    currentFile,
    currentFileName: fileName,
    processedFiles: result ? existing.processedFiles + 1 : existing.processedFiles,
  };

  if (result) {
    updates.results = [...existing.results, result];
    if (result.success) {
      updates.successCount = existing.successCount + 1;
    } else {
      updates.failureCount = existing.failureCount + 1;
    }
  }

  setProgress(progressId, updates);
}

/**
 * Complete progress
 */
export function completeProgress(progressId: string): void {
  setProgress(progressId, {
    status: 'completed',
  });
}

/**
 * Error progress
 */
export function errorProgress(progressId: string, error: string): void {
  setProgress(progressId, {
    status: 'error',
    error,
  });
}

