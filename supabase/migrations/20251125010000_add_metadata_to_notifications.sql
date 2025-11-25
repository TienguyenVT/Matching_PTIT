-- Thêm cột metadata vào bảng notifications
ALTER TABLE public.notifications 
ADD COLUMN metadata JSONB;

-- Cập nhật RLS policy nếu cần
-- (Không cần thay đổi policy vì metadata là trường bổ sung, không ảnh hưởng đến quyền truy cập)

-- Cập nhật comment cho cột mới
COMMENT ON COLUMN public.notifications.metadata IS 'Dữ liệu bổ sung cho thông báo, có thể chứa các thông tin tùy chỉnh';
