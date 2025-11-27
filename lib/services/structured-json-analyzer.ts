import fs from 'fs';
import path from 'path';

export interface JSONAnalysisResult {
  chapters: Array<{
    chapterNumber: number;
    title: string;
    sections: Array<{
      sectionNumber: number;
      title: string;
      content: string;
    }>;
  }>;
  fileName?: string;
}

/**
 * Phân tích file JSON có cấu trúc chương/mục và trả về cấu trúc chương/section
 * Hỗ trợ các cấp level_1/2/3/4; sẽ gom thành sections ở cấp thấp nhất có content
 */
export function analyzeStructuredJSON(filePath: string): JSONAnalysisResult {
  const fileName = path.basename(filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw || raw.trim().length === 0) {
    throw new Error(`File JSON rỗng: ${fileName}`);
  }
  let json: any;
  try {
    json = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`JSON không hợp lệ (${fileName}): ${e.message}`);
  }

  const data = Array.isArray(json.data) ? json.data : [];
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`JSON không đúng cấu trúc (thiếu mảng data) hoặc không có chương: ${fileName}`);
  }

  const chapters: JSONAnalysisResult['chapters'] = [];

  let chapterIndex = 0;
  for (const level1 of data) {
    chapterIndex += 1;
    const chapterTitle: string = typeof level1.level_1_title === 'string' && level1.level_1_title.trim() ? level1.level_1_title : `Chương ${chapterIndex}`;

    const sections: Array<{ sectionNumber: number; title: string; content: string }> = [];

    // Helper để push section
    let sectionIdx = 0;
    const pushSection = (title: string, content: string) => {
      sectionIdx += 1;
      sections.push({ sectionNumber: sectionIdx, title: title.trim(), content: (content || '').trim() });
    };

    const walkChildren = (node: any, prefixTitle?: string) => {
      if (!node) return;
      // Nếu node có content thì coi như một section
      if (node && typeof node.content === 'string' && node.content.trim()) {
        const t = node.level_4_title || node.level_3_title || node.level_2_title || node.level_1_title || 'Mục';
        const fullTitle = prefixTitle ? `${prefixTitle} — ${t}` : t;
        pushSection(fullTitle, node.content);
      }
      // Nếu có children, duyệt tiếp
      if (Array.isArray(node.children)) {
        const t = node.level_4_title || node.level_3_title || node.level_2_title || node.level_1_title;
        const newPrefix = prefixTitle || (t ? t : undefined);
        for (const child of node.children) {
          walkChildren(child, newPrefix);
        }
      }
    };

    if (Array.isArray(level1.children)) {
      for (const lvl2 of level1.children) {
        // Nếu level_2 có content → section
        if (lvl2?.content) {
          pushSection(lvl2.level_2_title || 'Mục', lvl2.content);
        }
        // Nếu có children sâu hơn → duyệt để tạo sections
        if (Array.isArray(lvl2.children)) {
          for (const lvl3 of lvl2.children) {
            if (lvl3?.content) {
              pushSection(lvl3.level_3_title || 'Mục', lvl3.content);
            }
            if (Array.isArray(lvl3.children)) {
              for (const lvl4 of lvl3.children) {
                if (lvl4?.content) {
                  pushSection(lvl4.level_4_title || 'Mục', lvl4.content);
                } else if (Array.isArray(lvl4.children)) {
                  walkChildren(lvl4, lvl3.level_3_title);
                }
              }
            }
          }
        }
      }
    }

    // Nếu không có section nào, tạo một section placeholder từ tiêu đề chương
    if (sections.length === 0) {
      sections.push({ sectionNumber: 1, title: `${chapterTitle} - Tổng quan`, content: '' });
    }

    chapters.push({
      chapterNumber: chapterIndex,
      title: chapterTitle,
      sections
    });
  }

  return { chapters, fileName };
}
