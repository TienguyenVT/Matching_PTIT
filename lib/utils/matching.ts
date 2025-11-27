/**
 * Matching Algorithm Utilities
 * Thuật toán matching người dùng dựa trên:
 * - Cùng khóa học (40%)
 * - Cùng trình độ (30%)
 * - Cùng tiến độ học tập (30% - hiện tại không có tracking, sẽ tính sau)
 */

export interface UserCourseData {
  courseId: string;
  level: string | null;
}

export interface MatchingUser {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  courses: UserCourseData[];
}

export interface MatchScore {
  user: MatchingUser;
  score: number;
  commonCourses: string[];
  levelMatches: number;
  details: {
    courseScore: number;
    levelScore: number;
    progressScore: number;
  };
}

/**
 * Tìm khóa học chung giữa 2 người dùng
 * Kiểm tra course_id trùng lặp giữa user1 và user2
 * 
 * @param user1 - Người dùng thứ nhất
 * @param user2 - Người dùng thứ hai
 * @returns Mảng các course_id chung giữa 2 người dùng
 */
export function findCommonCourses(
  user1: MatchingUser,
  user2: MatchingUser
): string[] {
  // Validate input
  if (!user1?.courses || !user2?.courses) {
    return [];
  }
  
  // Hỗ trợ cả hai dạng field: courseId (chuẩn trong app) và course_id (raw từ DB)
  const getCourseId = (c: any): string | null => c?.courseId || c?.course_id || null;

  // Loại bỏ duplicate course_id và null/undefined values
  const user1CourseIds = new Set(
    user1.courses
      .map((c) => getCourseId(c))
      .filter((id): id is string => Boolean(id))
  );
  
  // Loại bỏ duplicate course_id và null/undefined values từ user2
  // Filter để tìm những course_id có trong Set của user1
  // Đây chính là logic kiểm tra course_id trùng lặp
  const user2CourseIds = user2.courses
    .map((c) => getCourseId(c))
    .filter((id): id is string => Boolean(id));
  
  // Tìm common courses
  const commonCourses = user2CourseIds.filter((courseId) => 
    user1CourseIds.has(courseId)
  );
  
  // Loại bỏ duplicate trong kết quả (nếu có)
  const uniqueCommonCourses = Array.from(new Set(commonCourses));
  
  // Debug logging (chỉ log khi có common courses để tránh spam)
  if (uniqueCommonCourses.length > 0 && typeof window === 'undefined') { // Server-side only
    console.log(`[findCommonCourses] User ${user1.id || 'current'} vs ${user2.id || 'target'}: ${uniqueCommonCourses.length} common courses:`, uniqueCommonCourses);
  }
  
  return uniqueCommonCourses;
}

/**
 * Tính điểm cùng trình độ
 * So khớp level của các khóa học chung
 */
export function calculateLevelMatch(
  user1: MatchingUser,
  user2: MatchingUser,
  commonCourses: string[]
): number {
  if (commonCourses.length === 0) return 0;

  let levelMatches = 0;
  for (const courseId of commonCourses) {
    const user1Course = user1.courses.find((c) => c.courseId === courseId);
    const user2Course = user2.courses.find((c) => c.courseId === courseId);

    if (
      user1Course?.level &&
      user2Course?.level &&
      user1Course.level === user2Course.level
    ) {
      levelMatches++;
    }
  }

  return levelMatches / commonCourses.length;
}

/**
 * Tính điểm cùng tiến độ học tập
 * Sau này có thể implement dựa trên bảng user_progress hoặc tương tự
 * 
 * @returns Tỷ lệ từ 0-1, với 0.5 là điểm trung bình (chưa có tracking)
 */
export function calculateProgressMatch(
  user1: MatchingUser,
  user2: MatchingUser,
  commonCourses: string[]
): number {
  // TODO: Implement khi có bảng tracking progress
  // Hiện tại trả về điểm trung bình (0.5) để tính 10/20 điểm
  // Logic sẽ so sánh tiến độ học tập trên các khóa học chung
  return 0.5;
}

/**
 * Tính điểm matching tổng thể
 * 
 * Thứ tự ưu tiên:
 * 1. Có khóa học chung + cùng trình độ + cùng tiến độ (điểm cao nhất)
 * 2. Có khóa học chung + cùng trình độ (điểm cao)
 * 3. Có khóa học chung (điểm trung bình)
 * 4. Không có khóa học chung (điểm thấp, nhưng vẫn hiển thị)
 */
export function calculateMatchScore(
  currentUser: MatchingUser,
  targetUser: MatchingUser
): MatchScore {
  // 1. Tìm khóa học chung
  const commonCourses = findCommonCourses(currentUser, targetUser);

  let courseScore: number;
  let levelScore: number;
  let progressScore: number;

  if (commonCourses.length === 0) {
    // Không có khóa học chung: cho điểm thấp (5 điểm) để vẫn hiển thị
    // nhưng ở cuối danh sách
    courseScore = 0;
    levelScore = 0;
    progressScore = 5; // Điểm cơ bản để user vẫn xuất hiện
  } else {
    // 2. Tính điểm cùng khóa học (50% - tăng từ 40%)
    // Tính dựa trên số khóa học chung so với tổng số khóa học
    const maxCourses = Math.max(
      currentUser.courses.length,
      targetUser.courses.length
    );
    // Tăng trọng số khóa học chung lên 50% để ưu tiên hơn
    courseScore = Math.min(
      (commonCourses.length / maxCourses) * 50,
      50
    );

    // 3. Tính điểm cùng trình độ (30%)
    // Chỉ tính khi có khóa học chung
    const levelMatchRatio = calculateLevelMatch(
      currentUser,
      targetUser,
      commonCourses
    );
    levelScore = levelMatchRatio * 30;

    // 4. Tính điểm cùng tiến độ (20% - giảm từ 30% vì chưa có tracking)
    // Chỉ tính khi có khóa học chung
    const progressMatchRatio = calculateProgressMatch(
      currentUser,
      targetUser,
      commonCourses
    );
    progressScore = progressMatchRatio * 20;
  }

  // Tổng điểm (0-100, hoặc 5-100 nếu không có khóa học chung)
  const totalScore = courseScore + levelScore + progressScore;

  // Tính số level matches (chỉ khi có khóa học chung)
  const levelMatchRatio = commonCourses.length > 0
    ? calculateLevelMatch(currentUser, targetUser, commonCourses)
    : 0;

  return {
    user: targetUser,
    score: Math.round(totalScore * 100) / 100,
    commonCourses,
    levelMatches: Math.round(levelMatchRatio * commonCourses.length),
    details: {
      courseScore: Math.round(courseScore * 100) / 100,
      levelScore: Math.round(levelScore * 100) / 100,
      progressScore: Math.round(progressScore * 100) / 100,
    },
  };
}

/**
 * Sắp xếp danh sách matches theo điểm giảm dần
 */
export function sortMatchesByScore(matches: MatchScore[]): MatchScore[] {
  return matches.sort((a, b) => b.score - a.score);
}

