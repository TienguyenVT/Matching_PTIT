import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { 
  analyzePDFWithGemini, 
  analyzeLargePDF, 
  splitPDFIntoChunks,
  GeminiResponse 
} from './gemini-client';

/**
 * Service phân tích PDF và tạo cấu trúc khóa học
 */

export interface PDFAnalysisResult {
  chapters: Array<{
    chapterNumber: number;
    title: string;
    sections: Array<{
      sectionNumber: number;
      title: string;
      content: string;
    }>;
  }>;
  totalPages?: number;
  fileName?: string;
  fullText?: string; // Lưu full text để dùng cho content generation
}

/**
 * Extract text từ file PDF
 * @param filePath Đường dẫn đến file PDF
 * @returns Text content và metadata
 */
export async function extractTextFromPDF(filePath: string): Promise<{
  text: string;
  metadata: {
    pages: number;
    info: any;
  };
}> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info
      }
    };
  } catch (error: any) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Phân tích cấu trúc PDF và trả về chapters và sections
 * @param filePath Đường dẫn đến file PDF
 * @param apiKey API key cho Gemini (optional)
 * @returns Cấu trúc chapters và sections
 */
export async function analyzePDFStructure(
  filePath: string,
  apiKey?: string
): Promise<PDFAnalysisResult> {
  console.log(`Starting PDF analysis for: ${filePath}`);
  
  // Extract text từ PDF
  const { text, metadata } = await extractTextFromPDF(filePath);
  console.log(`Extracted ${metadata.pages} pages, ${text.length} characters`);
  
  // Xác định xem có cần chia chunks không (PDF lớn > 100 trang)
  const isLargePDF = metadata.pages > 100;
  
  let result: GeminiResponse;
  
  if (isLargePDF) {
    console.log('Large PDF detected, splitting into chunks...');
    // Chia PDF thành chunks
    const chunks = splitPDFIntoChunks(text);
    console.log(`Split into ${chunks.length} chunks`);
    
    // Phân tích từng chunk và merge kết quả
    result = await analyzeLargePDF(chunks, apiKey);
  } else {
    // Phân tích trực tiếp cho PDF nhỏ
    console.log('Analyzing PDF directly...');
    result = await analyzePDFWithGemini(text, apiKey);
  }
  
  const fileName = path.basename(filePath);
  
  return {
    chapters: result.chapters,
    totalPages: metadata.pages,
    fileName,
    fullText: text // Lưu full text để dùng cho content generation
  };
}

/**
 * Parse course name từ tên file PDF
 * @param fileName Tên file (ví dụ: "Cơ sở dữ liệu.pdf")
 * @returns Tên khóa học (ví dụ: "Cơ sở dữ liệu")
 */
export function parseCourseNameFromFileName(fileName: string): string {
  // Loại bỏ extension .pdf
  const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
  return nameWithoutExt.trim();
}

/**
 * Validate file là PDF
 * @param filePath Đường dẫn file
 * @returns true nếu là PDF hợp lệ
 */
export function validatePDFFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.pdf' && fs.existsSync(filePath);
}

