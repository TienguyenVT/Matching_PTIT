-- Xóa policy cũ nếu tồn tại
DROP POLICY IF EXISTS "Allow individual insert" ON public.notifications;

-- Tạo policy mới cho phép admin hoặc user tạo thông báo
CREATE POLICY "Allow insert for authenticated users" ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Hoặc nếu bạn muốn giới hạn quyền hơn, có thể dùng:
-- CREATE POLICY "Allow insert for authenticated users" ON public.notifications
--     FOR INSERT
--     TO authenticated
--     WITH CHECK (
--         -- Cho phép user tạo thông báo cho chính họ
--         (auth.uid() = user_id) OR
--         -- Hoặc cho phép admin tạo thông báo cho bất kỳ ai
--         (auth.jwt() ->> 'role' = 'service_role')
--     );
