import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseServiceRole } from '@/lib/supabase/server';
import { analyzePDFStructure, parseCourseNameFromFileName, validatePDFFile } from '@/lib/services/pdf-analyzer';
import { analyzeStructuredJSON } from '@/lib/services/structured-json-analyzer';
// AI removed: no content generation or quiz generation
import { createProgressId, initProgress, updateFileProgress, completeProgress, errorProgress } from '@/lib/services/batch-progress';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

/**
 * API endpoint để xử lý batch tất cả PDF trong folder documents
 * POST /api/admin/batch-process-pdfs
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user - support both Bearer token and cookies
    const authHeader = req.headers.get('authorization');
    let user;
    let supabase = supabaseServer();
    
    // Ưu tiên: Nếu có Bearer token, verify token
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
      
      if (url && anon) {
        // Tạo client tạm để verify token
        const tempClient = createClient(url, anon);
        const { data: { user: tokenUser }, error: tokenError } = await tempClient.auth.getUser(token);
        if (!tokenError && tokenUser) {
          user = tokenUser;
        }
      }
    }
    
    // Fallback: Lấy user từ cookie
    if (!user) {
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      if (!cookieError && cookieUser) {
        user = cookieUser;
      }
    }
    
    if (!user) {
      console.error('No user found. Auth header:', authHeader ? 'present' : 'missing');
      return NextResponse.json(
        { error: 'Unauthorized. Vui lòng đăng nhập.' },
        { status: 401 }
      );
    }

    // Get documents folder path
    const documentsPath = path.join(process.cwd(), 'documents');
    
    if (!fs.existsSync(documentsPath)) {
      return NextResponse.json(
        { error: 'Folder documents không tồn tại.' },
        { status: 404 }
      );
    }

    // Get all JSON files in documents folder
    const files = fs.readdirSync(documentsPath);
    const targetFiles = files.filter(file => file.toLowerCase().endsWith('.json'));

    if (targetFiles.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy file JSON nào trong folder documents.' },
        { status: 404 }
      );
    }

    console.log(`Found ${targetFiles.length} JSON files to process`);

    // Create progress ID và initialize progress
    const progressId = createProgressId(user.id);
    initProgress(progressId, targetFiles.length);

    // Return progress ID immediately để client có thể poll
    // Process sẽ chạy async trong background
    processBatchAsync(progressId, targetFiles, user.id, authHeader, supabase);

    return NextResponse.json({
      success: true,
      progressId,
      message: 'Batch processing started. Use progressId to poll progress.'
    });
  } catch (error: any) {
    console.error('Error starting batch processing:', error);
    return NextResponse.json(
      { error: 'Lỗi khởi động batch processing. Vui lòng thử lại.', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Process batch async (chạy trong background)
 */
async function processBatchAsync(
  progressId: string,
  filesToProcess: string[],
  userId: string,
  authHeader: string | null,
  supabase: any
) {
  try {
    const documentsPath = path.join(process.cwd(), 'documents');
    
    // Nếu dùng Bearer token, dùng service role client để bypass RLS
    const supabaseAdmin = authHeader?.startsWith('Bearer ') 
      ? supabaseServiceRole() 
      : supabase;

    const results: Array<{
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
    }> = [];

    // Process each PDF file
    for (let i = 0; i < filesToProcess.length; i++) {
      const anyFile = filesToProcess[i];
      const filePath = path.join(documentsPath, anyFile);
      const isJSON = true; // batch chỉ xử lý JSON
      
      console.log(`\nProcessing: ${anyFile} (${i + 1}/${filesToProcess.length})`);
      
      // Update progress: đang xử lý file này
      updateFileProgress(progressId, i + 1, anyFile);

      try {
        // Validate file
        if (!fs.existsSync(filePath)) {
          const result = {
            fileName: anyFile,
            success: false,
            error: 'File không tồn tại.'
          };
          results.push(result);
          updateFileProgress(progressId, i + 1, anyFile, result);
          continue;
        }
        // Không xử lý PDF trong batch

        // Check if course already exists (by title)
        const courseName = parseCourseNameFromFileName(anyFile);
        const { data: existingCourse } = await supabaseAdmin
          .from('courses')
          .select('id, title')
          .eq('title', courseName)
          .eq('is_active', true)
          .maybeSingle();

        if (existingCourse) {
          console.log(`Course "${courseName}" already exists, skipping...`);
          const result = {
            fileName: anyFile,
            success: false,
            error: `Khóa học "${courseName}" đã tồn tại.`,
            courseId: existingCourse.id,
            courseTitle: existingCourse.title
          };
          results.push(result);
          updateFileProgress(progressId, i + 1, anyFile, result);
          continue;
        }

        // Analyze structure
        console.log(`Analyzing file structure...`);
        const analysisResult = isJSON ? analyzeStructuredJSON(filePath) : await analyzePDFStructure(filePath);
        console.log(`Analysis complete: ${analysisResult.chapters.length} chapters found`);
        
        // Debug: Log structure
        if (analysisResult.chapters.length === 0) {
          console.warn(`⚠️  No chapters found in file: ${anyFile}`);
          const result = {
            fileName: anyFile,
            success: false,
            error: 'Tài liệu không có cấu trúc chương rõ ràng. Không thể tạo khóa học.'
          };
          results.push(result);
          updateFileProgress(progressId, i + 1, anyFile, result);
          continue;
        }

        // Debug: Log first chapter structure
        if (analysisResult.chapters.length > 0) {
          const firstChapter = analysisResult.chapters[0];
          console.log(`First chapter: ${firstChapter.title}, ${firstChapter.sections.length} sections`);
        }

        // Create course
        const { data: course, error: courseError } = await supabaseAdmin
          .from('courses')
          .insert({
            title: courseName,
            description: `Khóa học được tạo tự động từ tài liệu: ${anyFile}`,
            level: 'Beginner', // Default level
            is_active: true,
            tags: []
          })
          .select()
          .single();

        if (courseError || !course) {
          console.error(`Error creating course for ${anyFile}:`, courseError);
          const result = {
            fileName: anyFile,
            success: false,
            error: `Không thể tạo khóa học: ${courseError?.message || 'Unknown error'}`
          };
          results.push(result);
          updateFileProgress(progressId, i + 1, anyFile, result);
          continue;
        }

        console.log(`Course created: ${course.id} - ${course.title}`);

        // Create modules and contents
        let moduleOrder = 0;
        let totalLessons = 0;

        for (const chapter of analysisResult.chapters) {
          moduleOrder++;
          
          // Create module
          console.log(`Creating module ${moduleOrder}: ${chapter.title} (Chapter ${chapter.chapterNumber})`);
          const { data: module, error: moduleError } = await supabaseAdmin
            .from('course_modules')
            .insert({
              course_id: course.id,
              title: chapter.title,
              chapter_number: chapter.chapterNumber,
              description: `Học phần ${chapter.chapterNumber}: ${chapter.title}`,
              order_index: moduleOrder
            })
            .select()
            .single();

          if (moduleError || !module) {
            console.error(`❌ Error creating module for chapter ${chapter.chapterNumber}:`, moduleError);
            console.error(`Module error details:`, JSON.stringify(moduleError, null, 2));
            // Log để debug
            if (moduleError) {
              console.error(`Module insert failed - course_id: ${course.id}, title: ${chapter.title}`);
            }
            continue; // Skip module này nhưng tiếp tục với modules khác
          }

          console.log(`Module created: ${module.id} - ${module.title}`);

          // Create lessons (sections) for this module
          console.log(`Creating lessons for module ${module.title} (${chapter.sections.length} sections)`);
          let lessonOrder = 0;
          for (const section of chapter.sections) {
            lessonOrder++;
            totalLessons++;

            try {
              // Tạo content (doc) cho bài học
              console.log(`Creating lesson ${lessonOrder}: ${section.title}`);
              const { data: lessonContent, error: contentError } = await supabaseAdmin
                .from('course_contents')
                .insert({
                  course_id: course.id,
                  module_id: module.id,
                  title: section.title,
                  kind: 'doc',
                  order_index: lessonOrder,
                  storage_path: null
                })
                .select()
                .single();

              if (contentError || !lessonContent) {
                console.error(`❌ Error creating lesson for section ${section.sectionNumber}:`, contentError);
                console.error(`Content error details:`, JSON.stringify(contentError, null, 2));
                if (contentError) {
                  console.error(`Lesson insert failed - course_id: ${course.id}, module_id: ${module.id}, title: ${section.title}`);
                }
                continue;
              }

              console.log(`✅ Lesson created: ${lessonContent.id} - ${section.title}`);

              // Lưu nội dung chi tiết cho bài học (từ JSON)
              try {
                const contentText = section.content || '';
                const { error: lessonContentInsertError } = await supabaseAdmin
                  .from('lesson_content')
                  .insert({
                    content_id: lessonContent.id,
                    content_text: contentText
                  });
                if (lessonContentInsertError) {
                  console.error(`Error inserting lesson content:`, lessonContentInsertError);
                }
              } catch (genError: any) {
                console.error(`Error saving lesson content:`, genError);
              }

            } catch (error: any) {
              console.error(`Error creating lesson:`, error);
            }
          }

          console.log(`Created ${lessonOrder} lessons for module ${module.title}`);
        }

        const result = {
          fileName: anyFile,
          success: true,
          courseId: course.id,
          courseTitle: course.title,
          statistics: {
            modules: moduleOrder,
            lessons: totalLessons,
            totalPages: analysisResult.totalPages
          }
        };
        results.push(result);
        updateFileProgress(progressId, i + 1, anyFile, result);

        console.log(`✅ Successfully processed: ${anyFile}`);

      } catch (error: any) {
        console.error(`Error processing ${anyFile}:`, error);
        const result = {
          fileName: anyFile,
          success: false,
          error: error.message || 'Unknown error occurred'
        };
        results.push(result);
        updateFileProgress(progressId, i + 1, anyFile, result);
      }

      // Add delay between files to avoid rate limiting
      if (i < filesToProcess.length - 1) {
        console.log('Waiting 2 seconds before processing next file...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Calculate summary
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const totalModules = results
      .filter(r => r.success && r.statistics)
      .reduce((sum, r) => sum + (r.statistics?.modules || 0), 0);
    const totalLessons = results
      .filter(r => r.success && r.statistics)
      .reduce((sum, r) => sum + (r.statistics?.lessons || 0), 0);

    // Complete progress
    completeProgress(progressId);

    console.log(`Batch processing completed: ${successCount}/${filesToProcess.length} successful`);
  } catch (error: any) {
    console.error('Error in batch processing:', error);
    errorProgress(progressId, error.message || 'Unknown error occurred');
  }
}

