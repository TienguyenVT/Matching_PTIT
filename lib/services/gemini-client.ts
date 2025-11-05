import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Wrapper cho Google Gemini API
 * Xử lý các tương tác với Gemini API
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyB8u7HVbUx35phyF5VlOQInvdvNNWW5C_Y';

export interface GeminiResponse {
  chapters: Array<{
    chapterNumber: number;
    title: string;
    sections: Array<{
      sectionNumber: number;
      title: string;
      content: string;
    }>;
  }>;
}

/**
 * Phân tích nội dung PDF với Gemini API
 * @param text Nội dung PDF đã được extract
 * @param apiKey API key cho Gemini (optional, sẽ dùng env nếu không có)
 * @returns Cấu trúc chapters và sections
 */
export async function analyzePDFWithGemini(
  text: string,
  apiKey?: string
): Promise<GeminiResponse> {
  const key = apiKey || GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(key);
  
  // Sử dụng Gemini 2.5 Pro hoặc fallback sang các model khác
  // Thử model theo thứ tự ưu tiên - lỗi 404 sẽ xuất hiện khi gọi generateContent, không phải khi tạo model
  const modelNames = [
    'gemini-2.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];
  
  let model = genAI.getGenerativeModel({ model: modelNames[0] });

  const prompt = `
Bạn là một chuyên gia phân tích tài liệu giáo dục. Hãy phân tích tài liệu PDF sau đây và trả về cấu trúc JSON với định dạng:

{
  "chapters": [
    {
      "chapterNumber": 1,
      "title": "Tên chương",
      "sections": [
        {
          "sectionNumber": 1.1,
          "title": "Tên mục/bài học",
          "content": "Tóm tắt ngắn gọn nội dung của mục này (2-3 câu)"
        }
      ]
    }
  ]
}

YÊU CẦU QUAN TRỌNG:
1. Nếu tài liệu KHÔNG có cấu trúc chương rõ ràng (không có tiêu đề "Chương 1", "Chapter 1", "CHƯƠNG I", v.v.):
   - Hãy CHIA tài liệu thành các phần logic dựa trên nội dung
   - Mỗi phần nên là một chủ đề hoặc concept riêng biệt
   - Đặt tên chương dựa trên nội dung chính của phần đó (ví dụ: "Giới thiệu", "Khái niệm cơ bản", "Nguyên lý hoạt động", "Ứng dụng thực tế", v.v.)
   - Mỗi chương nên có ít nhất 2-3 sections (mục/bài học)
   - Phân chia dựa trên các tiêu đề phụ, đoạn văn lớn, hoặc chủ đề thay đổi

2. Nếu tài liệu CÓ cấu trúc chương rõ ràng:
   - Sử dụng đúng các chương và mục có trong tài liệu
   - Giữ nguyên số thứ tự chương

3. LUÔN trả về ít nhất 3-5 chương, mỗi chương có 2-4 sections
4. Mỗi section phải có title và content (tóm tắt 2-3 câu)
5. Đánh số chương theo thứ tự: 1, 2, 3, ...
6. Đánh số mục theo định dạng: số_chương.số_mục (ví dụ: 1.1, 1.2, 2.1)
7. Chỉ trả về JSON hợp lệ, không có text thêm

Tài liệu:
${text.length > 100000 ? text.substring(0, 100000) + '\n... (tài liệu đã được cắt bớt để xử lý)' : text}
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Extract JSON từ response (có thể có markdown code blocks)
    let jsonText = responseText.trim();
    
    // Loại bỏ markdown code blocks nếu có
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    // Tìm JSON trong response nếu có text thêm
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText) as GeminiResponse;
    
    // Validate structure
    if (!parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error('Invalid response structure: missing chapters array');
    }

    // Validate: đảm bảo có ít nhất 1 chương
    if (parsed.chapters.length === 0) {
      throw new Error('No chapters found in PDF');
    }

    // Validate: mỗi chương phải có ít nhất 1 section
    for (const chapter of parsed.chapters) {
      if (!chapter.sections || chapter.sections.length === 0) {
        throw new Error(`Chapter "${chapter.title}" has no sections`);
      }
    }

    return parsed;
  } catch (error: any) {
    console.error('Error analyzing PDF with Gemini:', error);
    
    // Retry logic với exponential backoff
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Nếu model không tìm thấy (404), thử với model khác
    if (error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('is not found')) {
      console.log('Model not found, trying fallback models...');
      
      // Thử các model fallback
      for (let i = 1; i < modelNames.length; i++) {
        try {
          console.log(`Trying fallback model: ${modelNames[i]}...`);
          const fallbackModel = genAI.getGenerativeModel({ model: modelNames[i] });
          const result = await fallbackModel.generateContent(prompt);
          const response = await result.response;
          const responseText = response.text();
          let jsonText = responseText.trim();
          if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
          }
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
          const parsed = JSON.parse(jsonText) as GeminiResponse;
          if (parsed.chapters && parsed.chapters.length > 0) {
            console.log(`✅ Successfully used fallback model: ${modelNames[i]}`);
            return parsed;
          }
        } catch (fallbackError: any) {
          console.log(`Fallback model ${modelNames[i]} also failed:`, fallbackError.message);
          // Tiếp tục thử model tiếp theo
          if (i === modelNames.length - 1) {
            console.error('❌ All models failed');
          }
        }
      }
    }
    
    throw new Error(`Failed to analyze PDF: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Chia PDF thành chunks để xử lý (cho PDF lớn 200-500 trang)
 * @param text Toàn bộ nội dung PDF
 * @param chunkSize Số ký tự mỗi chunk (mặc định ~50-100 trang)
 * @returns Mảng các chunks
 */
export function splitPDFIntoChunks(
  text: string,
  chunkSize: number = 500000 // ~100 trang PDF
): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  // Chia theo đoạn để tránh cắt giữa câu
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Phân tích PDF lớn bằng cách chia thành chunks
 * @param chunks Mảng các chunks của PDF
 * @param apiKey API key
 * @returns Cấu trúc chapters và sections đã được merge
 */
export async function analyzeLargePDF(
  chunks: string[],
  apiKey?: string
): Promise<GeminiResponse> {
  const allChapters: GeminiResponse['chapters'] = [];
  let chapterOffset = 0;

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
    
    try {
      const chunkResult = await analyzePDFWithGemini(chunks[i], apiKey);
      
      // Merge chapters với offset cho chapter numbers
      for (const chapter of chunkResult.chapters) {
        // Điều chỉnh chapter number nếu cần
        if (i > 0 && chapter.chapterNumber === 1) {
          // Nếu chunk tiếp theo bắt đầu từ chapter 1, có thể là continuation
          // Cần logic phức tạp hơn để merge chapters
          chapter.chapterNumber = allChapters.length + 1;
        }
        allChapters.push(chapter);
      }
      
      // Delay giữa các requests để tránh rate limit
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    } catch (error: any) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      // Continue với chunks khác nếu một chunk fail
      if (error.message?.includes('Rate limit')) {
        // Wait longer nếu rate limited
        await new Promise(resolve => setTimeout(resolve, 5000));
        i--; // Retry chunk này
      }
    }
  }

  return { chapters: allChapters };
}

