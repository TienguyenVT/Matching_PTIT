import { NextRequest, NextResponse } from 'next/server';
import { getProgress } from '@/lib/services/batch-progress';

/**
 * API endpoint để lấy progress của batch processing
 * GET /api/admin/batch-progress/[progressId]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ progressId: string }> | { progressId: string } }
) {
  try {
    // Handle both sync and async params (Next.js 14/15 compatibility)
    const resolvedParams = params instanceof Promise ? await params : params;
    const { progressId } = resolvedParams;

    console.log(`[Batch Progress API] Fetching progress for ID: ${progressId}`);

    if (!progressId) {
      return NextResponse.json(
        { error: 'Progress ID is required' },
        { status: 400 }
      );
    }

    const progress = getProgress(progressId);

    if (!progress) {
      console.log(`[Batch Progress API] Progress not found for ID: ${progressId}`);
      return NextResponse.json(
        { error: 'Progress not found' },
        { status: 404 }
      );
    }

    console.log(`[Batch Progress API] Returning progress:`, {
      status: progress.status,
      currentFile: progress.currentFile,
      totalFiles: progress.totalFiles
    });

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error('Error getting progress:', error);
    return NextResponse.json(
      { error: 'Failed to get progress' },
      { status: 500 }
    );
  }
}

