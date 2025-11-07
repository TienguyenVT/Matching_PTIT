import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Service để AI sinh nội dung chi tiết cho bài học và bài kiểm tra
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyB8u7HVbUx35phyF5VlOQInvdvNNWW5C_Y';

export interface LessonContent {
  content_text: string; // Nội dung chi tiết của bài học
}

export interface QuizQuestion {
  question: string;
  options: string[]; // 4 lựa chọn
  correctAnswer: number; // Index của đáp án đúng (0-3)
  explanation?: string; // Giải thích đáp án
}

export interface QuizContent {
  questions: QuizQuestion[];
}

/**
 * Sinh nội dung chi tiết cho bài học dựa trên section content từ PDF
 */
export async function generateLessonContent(
  sectionTitle: string,
  sectionContent: string,
  chapterTitle: string,
  pdfText?: string
): Promise<LessonContent> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  // Thử các model names, fallback nếu có lỗi
  let model;
  try {
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  } catch {
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }
  }

  const prompt = `
Bạn là một giáo viên chuyên nghiệp. Hãy tạo nội dung bài học chi tiết dựa trên thông tin sau:

Chương: ${chapterTitle}
Bài học: ${sectionTitle}
Nội dung tóm tắt: ${sectionContent}

Yêu cầu:
1. Tạo nội dung bài học chi tiết, dễ hiểu, phù hợp với sinh viên
2. Nội dung phải có cấu trúc rõ ràng với các phần:
   - Giới thiệu
   - Nội dung chính (có thể chia thành các phần nhỏ)
   - Tóm tắt
3. Sử dụng tiếng Việt
4. Nội dung phải đầy đủ, khoảng 500-1000 từ
5. Format nội dung bằng HTML để dễ hiển thị (có thể dùng <h3>, <p>, <ul>, <li>, <strong>)

${pdfText ? `\nNếu cần, tham khảo thêm nội dung từ PDF:\n${pdfText.substring(0, 2000)}` : ''}

Trả về chỉ nội dung HTML, không có markdown code blocks.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let contentText = response.text().trim();

    // Loại bỏ markdown code blocks nếu có
    if (contentText.startsWith('```html')) {
      contentText = contentText.replace(/```html\n?/g, '').replace(/```\n?/g, '');
    } else if (contentText.startsWith('```')) {
      contentText = contentText.replace(/```\n?/g, '');
    }

    return {
      content_text: contentText
    };
  } catch (error: any) {
    console.error('Error generating lesson content:', error);
    // Fallback: trả về nội dung tóm tắt nếu không thể sinh
    return {
      content_text: `<h3>${sectionTitle}</h3><p>${sectionContent}</p>`
    };
  }
}

/**
 * Sinh bài kiểm tra trắc nghiệm 10 câu dựa trên nội dung chương
 */
export async function generateQuizContent(
  chapterTitle: string,
  chapterSections: Array<{ title: string; content: string }>,
  pdfText?: string
): Promise<QuizContent> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  
  // Thử các model names, fallback nếu có lỗi
  let model;
  try {
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
  } catch {
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch {
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    }
  }

  // Tạo danh sách nội dung từ các sections
  const sectionsInfo = chapterSections
    .map((s, idx) => `${idx + 1}. ${s.title}: ${s.content}`)
    .join('\n');

  const prompt = `
Bạn là một giáo viên chuyên nghiệp. Hãy tạo bài kiểm tra trắc nghiệm 10 câu hỏi dựa trên nội dung chương sau:

Chương: ${chapterTitle}

Nội dung các bài học trong chương:
${sectionsInfo}

Yêu cầu:
1. Tạo đúng 10 câu hỏi trắc nghiệm
2. Mỗi câu hỏi có 4 lựa chọn (A, B, C, D)
3. Chỉ có 1 đáp án đúng cho mỗi câu
4. Câu hỏi phải đa dạng, bao quát toàn bộ nội dung chương
5. Có giải thích ngắn gọn cho đáp án đúng
6. Sử dụng tiếng Việt
7. Trả về JSON với định dạng:
{
  "questions": [
    {
      "question": "Câu hỏi",
      "options": ["Lựa chọn A", "Lựa chọn B", "Lựa chọn C", "Lựa chọn D"],
      "correctAnswer": 0,
      "explanation": "Giải thích ngắn gọn"
    }
  ]
}

${pdfText ? `\nNếu cần, tham khảo thêm nội dung từ PDF:\n${pdfText.substring(0, 3000)}` : ''}

Chỉ trả về JSON, không có text thêm.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let responseText = response.text().trim();

    // Loại bỏ markdown code blocks nếu có
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(responseText) as QuizContent;

    // Validate: đảm bảo có đúng 10 câu hỏi
    if (!parsed.questions || parsed.questions.length !== 10) {
      console.warn(`Generated ${parsed.questions?.length || 0} questions, expected 10`);
      // Nếu không đủ 10 câu, tạo thêm hoặc giảm xuống
      if (parsed.questions && parsed.questions.length > 10) {
        parsed.questions = parsed.questions.slice(0, 10);
      }
    }

    // Validate mỗi câu hỏi có đúng 4 options
    parsed.questions = parsed.questions.map((q, idx) => {
      if (!q.options || q.options.length !== 4) {
        console.warn(`Question ${idx + 1} has ${q.options?.length || 0} options, expected 4`);
        // Nếu không đủ 4 options, tạo placeholder
        while (q.options.length < 4) {
          q.options.push(`Lựa chọn ${q.options.length + 1}`);
        }
        q.options = q.options.slice(0, 4);
      }
      // Đảm bảo correctAnswer trong phạm vi 0-3
      if (q.correctAnswer < 0 || q.correctAnswer > 3) {
        q.correctAnswer = 0;
      }
      return q;
    });

    return parsed;
  } catch (error: any) {
    console.error('Error generating quiz content:', error);
    // Fallback: tạo 10 câu hỏi mẫu
    return {
      questions: Array.from({ length: 10 }, (_, idx) => ({
        question: `Câu hỏi ${idx + 1} về ${chapterTitle}`,
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
        correctAnswer: 0,
        explanation: 'Đáp án đúng'
      }))
    };
  }
}

