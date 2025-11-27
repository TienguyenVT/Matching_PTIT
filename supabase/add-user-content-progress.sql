-- =====================================================
-- MIGRATION: TẠO BẢNG USER_CONTENT_PROGRESS LƯU TIẾN ĐỘ HỌC CỦA NGƯỜI DÙNG
-- Phiên bản: 1.0 - Ngày: 2025-11-26
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 Bắt đầu migration: Tạo bảng user_content_progress...';
END $$;

-- =====================================================
-- PHẦN 1: TẠO BẢNG USER_CONTENT_PROGRESS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_content_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.course_contents(id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  last_score numeric(5,2),
  last_attempt_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Unique progress per user / course / content
ALTER TABLE public.user_content_progress
  ADD CONSTRAINT user_content_progress_unique UNIQUE (user_id, course_id, content_id);

-- Indexes để tối ưu query
CREATE INDEX IF NOT EXISTS idx_user_content_progress_user_course 
  ON public.user_content_progress(user_id, course_id);

CREATE INDEX IF NOT EXISTS idx_user_content_progress_content 
  ON public.user_content_progress(content_id);

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo bảng user_content_progress và indexes';
END $$;

-- =====================================================
-- PHẦN 2: ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.user_content_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Bật RLS cho user_content_progress';
END $$;

-- =====================================================
-- PHẦN 3: RLS POLICIES CHO USER_CONTENT_PROGRESS
-- =====================================================

-- Cho phép user xem tiến độ học của chính mình, hoặc admin xem tất cả
DROP POLICY IF EXISTS "user_content_progress_select" ON public.user_content_progress;
CREATE POLICY "user_content_progress_select" ON public.user_content_progress
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'admin'
    )
  );

-- Cho phép user tạo/cập nhật tiến độ học của chính mình
DROP POLICY IF EXISTS "user_content_progress_insert" ON public.user_content_progress;
CREATE POLICY "user_content_progress_insert" ON public.user_content_progress
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "user_content_progress_update" ON public.user_content_progress;
CREATE POLICY "user_content_progress_update" ON public.user_content_progress
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- (Tuỳ chọn) Cho phép user xoá progress của chính mình nếu cần reset
DROP POLICY IF EXISTS "user_content_progress_delete" ON public.user_content_progress;
CREATE POLICY "user_content_progress_delete" ON public.user_content_progress
  FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
  );

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo RLS policies cho user_content_progress';
END $$;

-- =====================================================
-- PHẦN 4: VERIFICATION
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE '🎉 HOÀN TẤT MIGRATION USER_CONTENT_PROGRESS';
  RAISE NOTICE '================================';
END $$;

SELECT 
  '✅ MIGRATION COMPLETED' as status,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_content_progress') as user_content_progress_table_exists,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_content_progress') as user_content_progress_policies_count;
