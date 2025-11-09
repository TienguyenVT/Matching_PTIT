-- =====================================================
-- DATABASE PERFORMANCE OPTIMIZATION INDEXES (SAFE MODE)
-- =====================================================

-- 1. PROFILES TABLE (Kiểm tra tồn tại trước khi tạo index)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
        CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
        CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
        CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name) WHERE full_name IS NOT NULL;
    END IF;
END $$;

-- 2. USER_COURSES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_courses') THEN
        CREATE INDEX IF NOT EXISTS idx_user_courses_user_id ON user_courses(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_courses_course_id ON user_courses(course_id);
        CREATE INDEX IF NOT EXISTS idx_user_courses_user_course ON user_courses(user_id, course_id);
        CREATE INDEX IF NOT EXISTS idx_user_courses_created_at ON user_courses(created_at DESC);
    END IF;
END $$;

-- 3. COURSES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'courses') THEN
        CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses(is_active) WHERE is_active = true;
        CREATE INDEX IF NOT EXISTS idx_courses_level ON courses(level);
        CREATE INDEX IF NOT EXISTS idx_courses_active_created ON courses(is_active, created_at DESC);
        -- Chỉ tạo index full-text search nếu cột title tồn tại
        BEGIN
            CREATE INDEX IF NOT EXISTS idx_courses_title ON courses USING gin(to_tsvector('english', title));
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping title index (column might be missing)';
        END;
    END IF;
END $$;

-- 4. CHAT_ROOMS TABLE (Gây lỗi trước đó)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_rooms') THEN
        CREATE INDEX IF NOT EXISTS idx_chat_rooms_status ON chat_rooms(status);
        CREATE INDEX IF NOT EXISTS idx_chat_rooms_course_id ON chat_rooms(course_id);
        CREATE INDEX IF NOT EXISTS idx_chat_rooms_matched_course ON chat_rooms(status, course_id) WHERE status = 'matched';
        CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_at ON chat_rooms(created_at DESC);
    END IF;
END $$;

-- 5. CHAT_MEMBERS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_members') THEN
        CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_chat_members_room_id ON chat_members(room_id);
        CREATE INDEX IF NOT EXISTS idx_chat_members_user_room ON chat_members(user_id, room_id);
    END IF;
END $$;

-- 6. MESSAGES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
        CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
    END IF;
END $$;

-- =====================================================
-- MAINTENANCE FUNCTIONS (Cập nhật để an toàn hơn)
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_table_stats()
RETURNS void AS $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'user_courses', 'courses', 'chat_rooms', 'chat_members', 'messages')
    LOOP
        EXECUTE 'ANALYZE ' || quote_ident(t);
    END LOOP;
    
    RAISE NOTICE 'Table statistics refreshed successfully for existing tables';
END;
$$ LANGUAGE plpgsql;

-- Chạy refresh stats
SELECT refresh_table_stats();