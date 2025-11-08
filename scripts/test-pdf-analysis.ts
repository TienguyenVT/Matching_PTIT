/**
 * Script test phân tích PDF
 * Chạy: npx tsx scripts/test-pdf-analysis.ts
 * 
 * Yêu cầu:
 * - Cài đặt tsx: npm install -D tsx
 * - Có file .env.local với GEMINI_API_KEY
 */

import { analyzePDFStructure, parseCourseNameFromFileName } from '../lib/services/pdf-analyzer';
import path from 'path';
import fs from 'fs';

async function testPDFAnalysis() {
  console.log('🧪 Bắt đầu test phân tích PDF...\n');

  // Test 1: PDF nhỏ
  console.log('📄 Test 1: PDF nhỏ (nếu có trong documents/)');
  const documentsPath = path.join(process.cwd(), 'documents');
  
  if (!fs.existsSync(documentsPath)) {
    console.log('❌ Folder documents không tồn tại');
    return;
  }

  const pdfFiles = fs.readdirSync(documentsPath)
    .filter(file => file.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => {
      // Sắp xếp theo size, nhỏ nhất trước
      const statA = fs.statSync(path.join(documentsPath, a));
      const statB = fs.statSync(path.join(documentsPath, b));
      return statA.size - statB.size;
    });

  if (pdfFiles.length === 0) {
    console.log('❌ Không tìm thấy file PDF nào trong folder documents/');
    return;
  }

  console.log(`📁 Tìm thấy ${pdfFiles.length} file PDF:\n`);
  pdfFiles.forEach((file, index) => {
    const filePath = path.join(documentsPath, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  ${index + 1}. ${file} (${sizeMB} MB)`);
  });

  // Chọn file nhỏ nhất để test
  const testFile = pdfFiles[0];
  const testFilePath = path.join(documentsPath, testFile);
  const testFileStats = fs.statSync(testFilePath);
  const testFileSizeMB = (testFileStats.size / 1024 / 1024).toFixed(2);

  console.log(`\n✅ Chọn file test: ${testFile} (${testFileSizeMB} MB)\n`);

  try {
    console.log('⏳ Đang phân tích PDF...');
    const startTime = Date.now();
    
    const result = await analyzePDFStructure(testFilePath);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Phân tích hoàn tất trong ${duration} giây\n`);
    console.log('📊 Kết quả:');
    console.log(`   - Tên file: ${result.fileName}`);
    console.log(`   - Tổng số trang: ${result.totalPages}`);
    console.log(`   - Số học phần (chapters): ${result.chapters.length}`);
    
    let totalSections = 0;
    result.chapters.forEach((chapter, index) => {
      totalSections += chapter.sections.length;
      console.log(`   - Chương ${chapter.chapterNumber}: ${chapter.title} (${chapter.sections.length} mục)`);
    });
    
    console.log(`   - Tổng số bài học (sections): ${totalSections}\n`);

    // Kiểm tra cấu trúc
    console.log('🔍 Kiểm tra cấu trúc:');
    const hasEmptyChapters = result.chapters.some(ch => ch.sections.length === 0);
    const hasDuplicateChapters = new Set(result.chapters.map(ch => ch.chapterNumber)).size !== result.chapters.length;
    
    if (hasEmptyChapters) {
      console.log('   ⚠️  Cảnh báo: Có chương không có mục');
    } else {
      console.log('   ✅ Tất cả chương đều có mục');
    }
    
    if (hasDuplicateChapters) {
      console.log('   ⚠️  Cảnh báo: Có chương trùng số');
    } else {
      console.log('   ✅ Không có chương trùng số');
    }

    // Test parse course name
    const courseName = parseCourseNameFromFileName(testFile);
    console.log(`\n📚 Tên khóa học được tạo: "${courseName}"`);

    console.log('\n✅ Test hoàn tất!\n');

  } catch (error: any) {
    console.error('\n❌ Lỗi khi phân tích PDF:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

// Chạy test
testPDFAnalysis().catch(console.error);

