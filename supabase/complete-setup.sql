-- =====================================================
-- TODOWEB DATABASE - COMPLETE SETUP SCRIPT
-- TẠO TOÀN BỘ DATABASE, RLS POLICIES VÀ SEED DATA
-- Phiên bản: 1.0 - Ngày: 2025-11-01
-- =====================================================
-- Mục đích: Chạy TẤT CẢ trong 1 lần duy nhất tại Supabase SQL Editor
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 BẮT ĐẦU SETUP DATABASE...';
  RAISE NOTICE '================================';
END $$;

-- =====================================================
-- PHẦN 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo Extensions (uuid-ossp, pgcrypto)';
END $$;

-- =====================================================
-- PHẦN 2: TẠO CÁC BẢNG
-- =====================================================

-- Bảng profiles: mirror của auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- Bảng courses: danh sách khóa học
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  cover_url text,
  level text,
  tags text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Bảng user_courses: đăng ký khóa học
CREATE TABLE IF NOT EXISTS public.user_courses (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

-- Tạo ENUM cho content_kind
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_kind') THEN
        CREATE TYPE public.content_kind AS ENUM ('video','doc','quiz');
    END IF;
END$$;

-- Bảng course_contents: nội dung khóa học
CREATE TABLE IF NOT EXISTS public.course_contents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind content_kind NOT NULL,
  storage_path text,
  order_index int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_contents_course_order ON public.course_contents(course_id, order_index);

-- Tạo ENUM cho room_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
        CREATE TYPE public.room_status AS ENUM ('open','matched','closed');
    END IF;
END$$;

-- Bảng chat_rooms: phòng chat 1:1
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status room_status NOT NULL DEFAULT 'open',
  created_at timestamp with time zone DEFAULT now()
);

-- Bảng chat_members: thành viên phòng chat
CREATE TABLE IF NOT EXISTS public.chat_members (
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id);

-- Tạo ENUM cho message_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
        CREATE TYPE public.message_type AS ENUM ('text','image','audio','video','file');
    END IF;
END$$;

-- Bảng chat_messages: tin nhắn trong chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  type message_type NOT NULL DEFAULT 'text',
  file_url text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON public.chat_messages(room_id, created_at DESC);

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo tất cả tables (profiles, courses, user_courses, course_contents, chat_rooms, chat_members, chat_messages)';
END $$;

-- =====================================================
-- PHẦN 3: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS cho tất cả tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Bật RLS cho tất cả tables';
END $$;

-- =====================================================
-- PHẦN 4: RLS POLICIES
-- =====================================================

-- Profiles policies
DROP POLICY IF EXISTS "profiles self select" ON public.profiles;
CREATE POLICY "profiles self select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
CREATE POLICY "profiles self insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Courses policies: cho phép public đọc active courses
DROP POLICY IF EXISTS "courses read active" ON public.courses;
CREATE POLICY "courses read active" ON public.courses
  FOR SELECT USING (is_active = true);

-- User courses policies: chỉ owner mới quản lý
DROP POLICY IF EXISTS "user_courses owner select" ON public.user_courses;
CREATE POLICY "user_courses owner select" ON public.user_courses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_courses owner insert" ON public.user_courses;
CREATE POLICY "user_courses owner insert" ON public.user_courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_courses owner delete" ON public.user_courses;
CREATE POLICY "user_courses owner delete" ON public.user_courses
  FOR DELETE USING (auth.uid() = user_id);

-- Course contents policies: cho phép authenticated users xem contents của active courses
DROP POLICY IF EXISTS "contents enrolled select" ON public.course_contents;
DROP POLICY IF EXISTS "contents active courses select" ON public.course_contents;
CREATE POLICY "contents active courses select" ON public.course_contents
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_contents.course_id 
      AND c.is_active = true
    )
  );

-- Chat rooms policies: chỉ members mới thấy
DROP POLICY IF EXISTS "rooms members select" ON public.chat_rooms;
CREATE POLICY "rooms members select" ON public.chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_rooms.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rooms insert server only" ON public.chat_rooms;
CREATE POLICY "rooms insert server only" ON public.chat_rooms
  FOR INSERT WITH CHECK (true);

-- Chat members policies
DROP POLICY IF EXISTS "members_access" ON public.chat_members;
CREATE POLICY "members_access" ON public.chat_members
  FOR ALL USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_members.room_id AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid()
  );

-- Chat messages policies
DROP POLICY IF EXISTS "messages room members select" ON public.chat_messages;
CREATE POLICY "messages room members select" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_messages.room_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages sender insert" ON public.chat_messages;
CREATE POLICY "messages sender insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_messages.room_id AND m.user_id = auth.uid()
    )
  );

-- Enable Realtime cho chat_messages
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo tất cả RLS policies';
END $$;

-- =====================================================
-- PHẦN 5: AUTO CREATE PROFILE TRIGGER
-- =====================================================

-- Function để tự động tạo profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger để chạy function khi có user mới
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix existing users: tạo profile cho users đã tồn tại nhưng chưa có profile
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO NOTHING;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✅ Hoàn thành: Trigger auto-create profile (% users được fix)', inserted_count;
END $$;

-- =====================================================
-- PHẦN 6: SEED DATA - KHOA HOC VA NOI DUNG
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '📦 Bắt đầu seed dữ liệu courses và contents...';
END $$;

-- Insert Courses
INSERT INTO "public"."courses" ("id", "title", "description", "cover_url", "level", "tags", "is_active", "created_at") VALUES 
('0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-10-31 20:14:26.896977+00'),
('0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-10-31 21:11:13.250663+00'),
('5b971276-7415-45a0-a420-9699cbb4ff62', 'Lập trình Web cơ bản', 'Khóa học nhập môn HTML/CSS/JS cho người mới bắt đầu', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200', 'Beginner', '{"web","html","css","javascript"}', 'true', '2025-10-31 18:11:14.438353+00'),
('b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-10-31 21:11:18.628623+00'),
('b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'React Cơ bản', 'Học React từ đầu với hooks, components và state management', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200', 'Beginner', '{"react","javascript","frontend"}', 'true', '2025-10-31 21:11:18.628623+00'),
('c781340a-dc51-4f79-bd73-b45a49b88e08', 'Lập trình Web cơ bản', 'Khóa học nhập môn HTML/CSS/JS cho người mới bắt đầu', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200', 'Beginner', '{"web","html","css","javascript"}', 'true', '2025-10-31 20:14:26.896977+00'),
('ccaa32e8-8112-4a27-b54a-5629cce97c34', 'React Cơ bản', 'Học React từ đầu với hooks, components và state management', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200', 'Beginner', '{"react","javascript","frontend"}', 'true', '2025-10-31 21:11:13.250663+00'),
('2ffb5483-e805-4914-b70f-d9e548f451ba', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-11-01 02:50:48.914545+00'),
('5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'React Cơ bản', 'Học React từ đầu với hooks, components và state management', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200', 'Beginner', '{"react","javascript","frontend"}', 'true', '2025-11-01 02:50:48.914545+00'),
('9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Lập trình Web cơ bản', 'Khóa học nhập môn HTML/CSS/JS cho người mới bắt đầu', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200', 'Beginner', '{"web","html","css","javascript"}', 'true', '2025-11-01 02:51:50.630264+00'),
('bfd5c836-eace-4910-9a77-f93cda404d68', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-11-01 02:51:50.630264+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  level = EXCLUDED.level,
  tags = EXCLUDED.tags,
  is_active = EXCLUDED.is_active;

DO $$
DECLARE
  courses_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO courses_count FROM public.courses WHERE is_active = true;
  RAISE NOTICE '✅ Hoàn thành: Seed courses (% active courses)', courses_count;
END $$;

-- Insert Course Contents
INSERT INTO "public"."course_contents" ("id", "course_id", "title", "kind", "storage_path", "order_index", "created_at") VALUES 
('03ba5265-c327-4d7e-8cba-a13f3be796e7', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'ES6+ Features', 'doc', null, 1, '2025-10-31 20:14:26.896977+00'),
('0e9c10f3-28b6-41fc-b32b-94e67e9d910c', 'bfd5c836-eace-4910-9a77-f93cda404d68', 'Bài tập thực hành', 'quiz', null, 3, '2025-11-01 02:51:50.630264+00'),
('266fce14-1192-4c84-97f4-14966eb746eb', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'React Hooks', 'doc', null, 3, '2025-10-31 21:11:18.628623+00'),
('28ff4c40-d2b2-4c94-a9c5-c1d4eec2a4ee', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'React Hooks', 'doc', null, 3, '2025-11-01 02:50:48.914545+00'),
('30b075df-974a-4b8d-a266-f9d24da676fc', '2ffb5483-e805-4914-b70f-d9e548f451ba', 'ES6+ Features', 'doc', null, 1, '2025-11-01 02:50:48.914545+00'),
('37809c47-b982-4b95-aabf-629fa5809f15', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Quiz giữa kỳ', 'quiz', null, 3, '2025-11-01 02:50:48.914545+00'),
('3929362f-87f3-4cab-b8fc-022b74376fa8', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'State & Events', 'video', null, 2, '2025-10-31 21:11:18.628623+00'),
('4c333db1-6304-4ed9-b637-cab2d1b3599c', '2ffb5483-e805-4914-b70f-d9e548f451ba', 'Async/Await Tutorial', 'video', null, 2, '2025-11-01 02:50:48.914545+00'),
('515676a2-2b51-4d5d-8e19-d027d2a8b3e8', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'Components & Props', 'doc', null, 1, '2025-11-01 02:50:48.914545+00'),
('5e905ffc-7b43-40c2-8d2c-8595e980af0e', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Async/Await Tutorial', 'video', null, 2, '2025-10-31 20:14:26.896977+00'),
('6149b63b-312e-44bc-8226-970772b3613a', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'React Hooks', 'doc', null, 3, '2025-10-31 21:11:13.250663+00'),
('6a4ab65c-bc2c-423c-a8e4-9353e1305d3d', '9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Giới thiệu HTML', 'doc', null, 1, '2025-11-01 02:51:50.630264+00'),
('6e65a993-339f-45bb-b3e9-17444d94ae14', 'c781340a-dc51-4f79-bd73-b45a49b88e08', 'Giới thiệu HTML', 'doc', null, 1, '2025-10-31 20:14:26.896977+00'),
('73274bb6-460b-4831-8ee0-6b29a387e96e', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Bài tập thực hành', 'quiz', null, 3, '2025-10-31 20:14:26.896977+00'),
('83d8fb50-3089-4125-9eb0-cf4423f2218f', '2ffb5483-e805-4914-b70f-d9e548f451ba', 'Bài tập thực hành', 'quiz', null, 3, '2025-11-01 02:50:48.914545+00'),
('8462fed0-f1b7-4ee6-ad68-decd31eb4370', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Video CSS cơ bản', 'video', null, 2, '2025-11-01 02:50:48.914545+00'),
('86972386-8987-4782-8db6-1b45b3edfb81', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Giới thiệu HTML', 'doc', null, 1, '2025-11-01 02:50:48.914545+00'),
('8dae95c5-dce6-4ee6-a417-61b961a34bbf', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'Components & Props', 'doc', null, 1, '2025-10-31 21:11:13.250663+00'),
('9de6210e-182d-4f73-8ede-d99c69728ba7', '9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Quiz giữa kỳ', 'quiz', null, 3, '2025-11-01 02:51:50.630264+00'),
('9f6b479f-1897-4e18-a622-a824406affb1', '9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Video CSS cơ bản', 'video', null, 2, '2025-11-01 02:51:50.630264+00'),
('a30cc845-0ede-4d20-93d5-0ed44023a3d1', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'State & Events', 'video', null, 2, '2025-10-31 21:11:13.250663+00'),
('a3705604-9b17-4cd1-a572-f457b14fd746', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'Bài tập cuối khóa', 'quiz', null, 4, '2025-10-31 21:11:18.628623+00'),
('b23f66f3-8965-4dc7-ad34-14fe1a7bc493', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'Bài tập cuối khóa', 'quiz', null, 4, '2025-10-31 21:11:13.250663+00'),
('b52952a2-09b9-44cd-9cc0-f78f1951f27b', 'c781340a-dc51-4f79-bd73-b45a49b88e08', 'Quiz giữa kỳ', 'quiz', null, 3, '2025-10-31 20:14:26.896977+00'),
('bac4b0ff-c7b8-40ea-8cec-06cbf15ba39c', 'b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'Async/Await Tutorial', 'video', null, 2, '2025-10-31 21:11:18.628623+00'),
('c31ebae7-f768-420c-bd92-c130b771f428', '0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'Async/Await Tutorial', 'video', null, 2, '2025-10-31 21:11:13.250663+00'),
('ce4551e5-3d8f-40c6-9234-4d723ead0707', 'c781340a-dc51-4f79-bd73-b45a49b88e08', 'Video CSS cơ bản', 'video', null, 2, '2025-10-31 20:14:26.896977+00'),
('dddf8716-4914-46f2-8ad8-4664909f06a5', 'b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'ES6+ Features', 'doc', null, 1, '2025-10-31 21:11:18.628623+00'),
('e312f1ea-7b47-473f-98d1-e985dac5569c', 'b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'Bài tập thực hành', 'quiz', null, 3, '2025-10-31 21:11:18.628623+00'),
('ebebcfa1-8b36-4cd0-944f-4501e792db1f', '0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'ES6+ Features', 'doc', null, 1, '2025-10-31 21:11:13.250663+00'),
('f6275e80-c23c-4158-a259-170fbf6ed12b', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'Components & Props', 'doc', null, 1, '2025-10-31 21:11:18.628623+00'),
('f6da4be0-4fda-4f8a-b2dc-8a46b99e3696', '0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'Bài tập thực hành', 'quiz', null, 3, '2025-10-31 21:11:13.250663+00'),
('faa525b8-4375-4907-bcfb-5f5e5ab4fb2e', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'Bài tập cuối khóa', 'quiz', null, 4, '2025-11-01 02:50:48.914545+00'),
('fad5b33a-aa1e-414b-b6f4-7981f1893f64', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'State & Events', 'video', null, 2, '2025-11-01 02:50:48.914545+00'),
('fe6551cb-c766-4bff-832e-67dee10be881', 'bfd5c836-eace-4910-9a77-f93cda404d68', 'ES6+ Features', 'doc', null, 1, '2025-11-01 02:51:50.630264+00'),
('ffa3c31c-e791-4af7-86bb-2756ee4ed56e', 'bfd5c836-eace-4910-9a77-f93cda404d68', 'Async/Await Tutorial', 'video', null, 2, '2025-11-01 02:51:50.630264+00')
ON CONFLICT (id) DO UPDATE SET
  course_id = EXCLUDED.course_id,
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  storage_path = EXCLUDED.storage_path,
  order_index = EXCLUDED.order_index;

DO $$
DECLARE
  contents_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO contents_count FROM public.course_contents;
  RAISE NOTICE '✅ Hoàn thành: Seed course contents (% contents)', contents_count;
END $$;

-- =====================================================
-- PHẦN 7: VERIFICATION & SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE '🎉 HOÀN TẤT SETUP DATABASE';
  RAISE NOTICE '================================';
END $$;

-- Kiểm tra kết quả
SELECT 
  '✅ SETUP COMPLETED' as status,
  (SELECT COUNT(*) FROM public.courses WHERE is_active = true) as active_courses,
  (SELECT COUNT(*) FROM public.course_contents) as total_contents,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('courses', 'course_contents', 'profiles', 'user_courses', 'chat_rooms', 'chat_members', 'chat_messages')) as total_policies;

-- Xem chi tiết courses
SELECT 
  id,
  title,
  level,
  array_length(tags, 1) as tag_count,
  is_active
FROM public.courses
ORDER BY created_at DESC;

-- Xem chi tiết course_contents cho course b2eb844d-9803-4ef3-af53-7568a9d5cd1d
SELECT 
  c.title as course_title,
  cc.title as content_title,
  cc.kind,
  cc.order_index
FROM public.course_contents cc
JOIN public.courses c ON cc.course_id = c.id
WHERE c.id = 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d'
ORDER BY cc.order_index;

-- =====================================================
-- SCRIPT HOÀN TẤT
-- =====================================================
-- =====================================================
-- TODOWEB DATABASE - COMPLETE SETUP SCRIPT
-- TẠO TOÀN BỘ DATABASE, RLS POLICIES VÀ SEED DATA
-- Phiên bản: 1.0 - Ngày: 2025-11-01
-- =====================================================
-- Mục đích: Chạy TẤT CẢ trong 1 lần duy nhất tại Supabase SQL Editor
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '🚀 BẮT ĐẦU SETUP DATABASE...';
  RAISE NOTICE '================================';
END $$;

-- =====================================================
-- PHẦN 1: EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo Extensions (uuid-ossp, pgcrypto)';
END $$;

-- =====================================================
-- PHẦN 2: TẠO CÁC BẢNG
-- =====================================================

-- Bảng profiles: mirror của auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- Bảng courses: danh sách khóa học
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  cover_url text,
  level text,
  tags text[],
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Bảng user_courses: đăng ký khóa học
CREATE TABLE IF NOT EXISTS public.user_courses (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, course_id)
);

-- Tạo ENUM cho content_kind
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_kind') THEN
        CREATE TYPE public.content_kind AS ENUM ('video','doc','quiz');
    END IF;
END$$;

-- Bảng course_contents: nội dung khóa học
CREATE TABLE IF NOT EXISTS public.course_contents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind content_kind NOT NULL,
  storage_path text,
  order_index int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_course_contents_course_order ON public.course_contents(course_id, order_index);

-- Tạo ENUM cho room_status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
        CREATE TYPE public.room_status AS ENUM ('open','matched','closed');
    END IF;
END$$;

-- Bảng chat_rooms: phòng chat 1:1
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status room_status NOT NULL DEFAULT 'open',
  created_at timestamp with time zone DEFAULT now()
);

-- Bảng chat_members: thành viên phòng chat
CREATE TABLE IF NOT EXISTS public.chat_members (
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON public.chat_members(user_id);

-- Tạo ENUM cho message_type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
        CREATE TYPE public.message_type AS ENUM ('text','image','audio','video','file');
    END IF;
END$$;

-- Bảng chat_messages: tin nhắn trong chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  type message_type NOT NULL DEFAULT 'text',
  file_url text,
  created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON public.chat_messages(room_id, created_at DESC);

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo tất cả tables (profiles, courses, user_courses, course_contents, chat_rooms, chat_members, chat_messages)';
END $$;

-- =====================================================
-- PHẦN 3: ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS cho tất cả tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Bật RLS cho tất cả tables';
END $$;

-- =====================================================
-- PHẦN 4: RLS POLICIES
-- =====================================================

-- Profiles policies
DROP POLICY IF EXISTS "profiles self select" ON public.profiles;
CREATE POLICY "profiles self select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles self update" ON public.profiles;
CREATE POLICY "profiles self update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles self insert" ON public.profiles;
CREATE POLICY "profiles self insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Courses policies: cho phép public đọc active courses
DROP POLICY IF EXISTS "courses read active" ON public.courses;
CREATE POLICY "courses read active" ON public.courses
  FOR SELECT USING (is_active = true);

-- User courses policies: chỉ owner mới quản lý
DROP POLICY IF EXISTS "user_courses owner select" ON public.user_courses;
CREATE POLICY "user_courses owner select" ON public.user_courses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_courses owner insert" ON public.user_courses;
CREATE POLICY "user_courses owner insert" ON public.user_courses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_courses owner delete" ON public.user_courses;
CREATE POLICY "user_courses owner delete" ON public.user_courses
  FOR DELETE USING (auth.uid() = user_id);

-- Course contents policies: cho phép authenticated users xem contents của active courses
DROP POLICY IF EXISTS "contents enrolled select" ON public.course_contents;
DROP POLICY IF EXISTS "contents active courses select" ON public.course_contents;
CREATE POLICY "contents active courses select" ON public.course_contents
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_contents.course_id 
      AND c.is_active = true
    )
  );

-- Chat rooms policies: chỉ members mới thấy
DROP POLICY IF EXISTS "rooms members select" ON public.chat_rooms;
CREATE POLICY "rooms members select" ON public.chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_rooms.id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rooms insert server only" ON public.chat_rooms;
CREATE POLICY "rooms insert server only" ON public.chat_rooms
  FOR INSERT WITH CHECK (true);

-- Chat members policies
DROP POLICY IF EXISTS "members_access" ON public.chat_members;
CREATE POLICY "members_access" ON public.chat_members
  FOR ALL USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_members.room_id AND m.user_id = auth.uid()
    )
  ) WITH CHECK (
    user_id = auth.uid()
  );

-- Chat messages policies
DROP POLICY IF EXISTS "messages room members select" ON public.chat_messages;
CREATE POLICY "messages room members select" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_messages.room_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages sender insert" ON public.chat_messages;
CREATE POLICY "messages sender insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.chat_members m
      WHERE m.room_id = chat_messages.room_id AND m.user_id = auth.uid()
    )
  );

-- Enable Realtime cho chat_messages
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Hoàn thành: Tạo tất cả RLS policies';
END $$;

-- =====================================================
-- PHẦN 5: AUTO CREATE PROFILE TRIGGER
-- =====================================================

-- Function để tự động tạo profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger để chạy function khi có user mới
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix existing users: tạo profile cho users đã tồn tại nhưng chưa có profile
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  SELECT 
    id,
    email,
    raw_user_meta_data->>'full_name' as full_name
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO NOTHING;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✅ Hoàn thành: Trigger auto-create profile (% users được fix)', inserted_count;
END $$;

-- =====================================================
-- PHẦN 6: SEED DATA - KHOA HOC VA NOI DUNG
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '📦 Bắt đầu seed dữ liệu courses và contents...';
END $$;

-- Insert Courses
INSERT INTO "public"."courses" ("id", "title", "description", "cover_url", "level", "tags", "is_active", "created_at") VALUES 
('0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-10-31 20:14:26.896977+00'),
('0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-10-31 21:11:13.250663+00'),
('5b971276-7415-45a0-a420-9699cbb4ff62', 'Lập trình Web cơ bản', 'Khóa học nhập môn HTML/CSS/JS cho người mới bắt đầu', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200', 'Beginner', '{"web","html","css","javascript"}', 'true', '2025-10-31 18:11:14.438353+00'),
('b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-10-31 21:11:18.628623+00'),
('b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'React Cơ bản', 'Học React từ đầu với hooks, components và state management', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200', 'Beginner', '{"react","javascript","frontend"}', 'true', '2025-10-31 21:11:18.628623+00'),
('c781340a-dc51-4f79-bd73-b45a49b88e08', 'Lập trình Web cơ bản', 'Khóa học nhập môn HTML/CSS/JS cho người mới bắt đầu', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200', 'Beginner', '{"web","html","css","javascript"}', 'true', '2025-10-31 20:14:26.896977+00'),
('ccaa32e8-8112-4a27-b54a-5629cce97c34', 'React Cơ bản', 'Học React từ đầu với hooks, components và state management', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200', 'Beginner', '{"react","javascript","frontend"}', 'true', '2025-10-31 21:11:13.250663+00'),
('2ffb5483-e805-4914-b70f-d9e548f451ba', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-11-01 02:50:48.914545+00'),
('5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'React Cơ bản', 'Học React từ đầu với hooks, components và state management', 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200', 'Beginner', '{"react","javascript","frontend"}', 'true', '2025-11-01 02:50:48.914545+00'),
('9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Lập trình Web cơ bản', 'Khóa học nhập môn HTML/CSS/JS cho người mới bắt đầu', 'https://images.unsplash.com/photo-1518779578993-ec3579fee39f?w=1200', 'Beginner', '{"web","html","css","javascript"}', 'true', '2025-11-01 02:51:50.630264+00'),
('bfd5c836-eace-4910-9a77-f93cda404d68', 'JavaScript Nâng cao', 'Khóa học về ES6+, Async/Await, Promises và các pattern nâng cao', 'https://images.unsplash.com/photo-1579468118864-1b9ea3caccdb?w=1200', 'Advanced', '{"javascript","es6","async","patterns"}', 'true', '2025-11-01 02:51:50.630264+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  level = EXCLUDED.level,
  tags = EXCLUDED.tags,
  is_active = EXCLUDED.is_active;

DO $$
DECLARE
  courses_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO courses_count FROM public.courses WHERE is_active = true;
  RAISE NOTICE '✅ Hoàn thành: Seed courses (% active courses)', courses_count;
END $$;

-- Insert Course Contents
INSERT INTO "public"."course_contents" ("id", "course_id", "title", "kind", "storage_path", "order_index", "created_at") VALUES 
('03ba5265-c327-4d7e-8cba-a13f3be796e7', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'ES6+ Features', 'doc', null, 1, '2025-10-31 20:14:26.896977+00'),
('0e9c10f3-28b6-41fc-b32b-94e67e9d910c', 'bfd5c836-eace-4910-9a77-f93cda404d68', 'Bài tập thực hành', 'quiz', null, 3, '2025-11-01 02:51:50.630264+00'),
('266fce14-1192-4c84-97f4-14966eb746eb', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'React Hooks', 'doc', null, 3, '2025-10-31 21:11:18.628623+00'),
('28ff4c40-d2b2-4c94-a9c5-c1d4eec2a4ee', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'React Hooks', 'doc', null, 3, '2025-11-01 02:50:48.914545+00'),
('30b075df-974a-4b8d-a266-f9d24da676fc', '2ffb5483-e805-4914-b70f-d9e548f451ba', 'ES6+ Features', 'doc', null, 1, '2025-11-01 02:50:48.914545+00'),
('37809c47-b982-4b95-aabf-629fa5809f15', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Quiz giữa kỳ', 'quiz', null, 3, '2025-11-01 02:50:48.914545+00'),
('3929362f-87f3-4cab-b8fc-022b74376fa8', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'State & Events', 'video', null, 2, '2025-10-31 21:11:18.628623+00'),
('4c333db1-6304-4ed9-b637-cab2d1b3599c', '2ffb5483-e805-4914-b70f-d9e548f451ba', 'Async/Await Tutorial', 'video', null, 2, '2025-11-01 02:50:48.914545+00'),
('515676a2-2b51-4d5d-8e19-d027d2a8b3e8', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'Components & Props', 'doc', null, 1, '2025-11-01 02:50:48.914545+00'),
('5e905ffc-7b43-40c2-8d2c-8595e980af0e', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Async/Await Tutorial', 'video', null, 2, '2025-10-31 20:14:26.896977+00'),
('6149b63b-312e-44bc-8226-970772b3613a', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'React Hooks', 'doc', null, 3, '2025-10-31 21:11:13.250663+00'),
('6a4ab65c-bc2c-423c-a8e4-9353e1305d3d', '9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Giới thiệu HTML', 'doc', null, 1, '2025-11-01 02:51:50.630264+00'),
('6e65a993-339f-45bb-b3e9-17444d94ae14', 'c781340a-dc51-4f79-bd73-b45a49b88e08', 'Giới thiệu HTML', 'doc', null, 1, '2025-10-31 20:14:26.896977+00'),
('73274bb6-460b-4831-8ee0-6b29a387e96e', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Bài tập thực hành', 'quiz', null, 3, '2025-10-31 20:14:26.896977+00'),
('83d8fb50-3089-4125-9eb0-cf4423f2218f', '2ffb5483-e805-4914-b70f-d9e548f451ba', 'Bài tập thực hành', 'quiz', null, 3, '2025-11-01 02:50:48.914545+00'),
('8462fed0-f1b7-4ee6-ad68-decd31eb4370', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Video CSS cơ bản', 'video', null, 2, '2025-11-01 02:50:48.914545+00'),
('86972386-8987-4782-8db6-1b45b3edfb81', '0258723d-f9e1-452d-9cd8-5dd7699dab6c', 'Giới thiệu HTML', 'doc', null, 1, '2025-11-01 02:50:48.914545+00'),
('8dae95c5-dce6-4ee6-a417-61b961a34bbf', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'Components & Props', 'doc', null, 1, '2025-10-31 21:11:13.250663+00'),
('9de6210e-182d-4f73-8ede-d99c69728ba7', '9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Quiz giữa kỳ', 'quiz', null, 3, '2025-11-01 02:51:50.630264+00'),
('9f6b479f-1897-4e18-a622-a824406affb1', '9b6196ef-a3b9-40e1-8b14-5a9e799889f8', 'Video CSS cơ bản', 'video', null, 2, '2025-11-01 02:51:50.630264+00'),
('a30cc845-0ede-4d20-93d5-0ed44023a3d1', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'State & Events', 'video', null, 2, '2025-10-31 21:11:13.250663+00'),
('a3705604-9b17-4cd1-a572-f457b14fd746', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'Bài tập cuối khóa', 'quiz', null, 4, '2025-10-31 21:11:18.628623+00'),
('b23f66f3-8965-4dc7-ad34-14fe1a7bc493', 'ccaa32e8-8112-4a27-b54a-5629cce97c34', 'Bài tập cuối khóa', 'quiz', null, 4, '2025-10-31 21:11:13.250663+00'),
('b52952a2-09b9-44cd-9cc0-f78f1951f27b', 'c781340a-dc51-4f79-bd73-b45a49b88e08', 'Quiz giữa kỳ', 'quiz', null, 3, '2025-10-31 20:14:26.896977+00'),
('bac4b0ff-c7b8-40ea-8cec-06cbf15ba39c', 'b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'Async/Await Tutorial', 'video', null, 2, '2025-10-31 21:11:18.628623+00'),
('c31ebae7-f768-420c-bd92-c130b771f428', '0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'Async/Await Tutorial', 'video', null, 2, '2025-10-31 21:11:13.250663+00'),
('ce4551e5-3d8f-40c6-9234-4d723ead0707', 'c781340a-dc51-4f79-bd73-b45a49b88e08', 'Video CSS cơ bản', 'video', null, 2, '2025-10-31 20:14:26.896977+00'),
('dddf8716-4914-46f2-8ad8-4664909f06a5', 'b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'ES6+ Features', 'doc', null, 1, '2025-10-31 21:11:18.628623+00'),
('e312f1ea-7b47-473f-98d1-e985dac5569c', 'b015f4a1-1c2d-4f8d-80fe-ca8d2f4c1164', 'Bài tập thực hành', 'quiz', null, 3, '2025-10-31 21:11:18.628623+00'),
('ebebcfa1-8b36-4cd0-944f-4501e792db1f', '0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'ES6+ Features', 'doc', null, 1, '2025-10-31 21:11:13.250663+00'),
('f6275e80-c23c-4158-a259-170fbf6ed12b', 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d', 'Components & Props', 'doc', null, 1, '2025-10-31 21:11:18.628623+00'),
('f6da4be0-4fda-4f8a-b2dc-8a46b99e3696', '0683f9f1-0e0d-4688-a19d-8adcf9a8be0b', 'Bài tập thực hành', 'quiz', null, 3, '2025-10-31 21:11:13.250663+00'),
('faa525b8-4375-4907-bcfb-5f5e5ab4fb2e', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'Bài tập cuối khóa', 'quiz', null, 4, '2025-11-01 02:50:48.914545+00'),
('fad5b33a-aa1e-414b-b6f4-7981f1893f64', '5fcd2fad-d2f4-4081-8ebe-8483ac04613e', 'State & Events', 'video', null, 2, '2025-11-01 02:50:48.914545+00'),
('fe6551cb-c766-4bff-832e-67dee10be881', 'bfd5c836-eace-4910-9a77-f93cda404d68', 'ES6+ Features', 'doc', null, 1, '2025-11-01 02:51:50.630264+00'),
('ffa3c31c-e791-4af7-86bb-2756ee4ed56e', 'bfd5c836-eace-4910-9a77-f93cda404d68', 'Async/Await Tutorial', 'video', null, 2, '2025-11-01 02:51:50.630264+00')
ON CONFLICT (id) DO UPDATE SET
  course_id = EXCLUDED.course_id,
  title = EXCLUDED.title,
  kind = EXCLUDED.kind,
  storage_path = EXCLUDED.storage_path,
  order_index = EXCLUDED.order_index;

DO $$
DECLARE
  contents_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO contents_count FROM public.course_contents;
  RAISE NOTICE '✅ Hoàn thành: Seed course contents (% contents)', contents_count;
END $$;

-- =====================================================
-- PHẦN 7: VERIFICATION & SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '================================';
  RAISE NOTICE '🎉 HOÀN TẤT SETUP DATABASE';
  RAISE NOTICE '================================';
END $$;

-- Kiểm tra kết quả
SELECT 
  '✅ SETUP COMPLETED' as status,
  (SELECT COUNT(*) FROM public.courses WHERE is_active = true) as active_courses,
  (SELECT COUNT(*) FROM public.course_contents) as total_contents,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('courses', 'course_contents', 'profiles', 'user_courses', 'chat_rooms', 'chat_members', 'chat_messages')) as total_policies;

-- Xem chi tiết courses
SELECT 
  id,
  title,
  level,
  array_length(tags, 1) as tag_count,
  is_active
FROM public.courses
ORDER BY created_at DESC;

-- Xem chi tiết course_contents cho course b2eb844d-9803-4ef3-af53-7568a9d5cd1d
SELECT 
  c.title as course_title,
  cc.title as content_title,
  cc.kind,
  cc.order_index
FROM public.course_contents cc
JOIN public.courses c ON cc.course_id = c.id
WHERE c.id = 'b2eb844d-9803-4ef3-af53-7568a9d5cd1d'
ORDER BY cc.order_index;

-- =====================================================
-- SCRIPT HOÀN TẤT
-- =====================================================
