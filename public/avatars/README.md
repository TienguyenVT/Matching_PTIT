# Avatars Folder

Thư mục này chứa các avatar mặc định mà người dùng có thể chọn.

## Hướng dẫn sử dụng:

1. Thêm các file ảnh avatar vào thư mục này (format: .jpg, .png, .webp)
2. Đặt tên file theo format: `avatar-1.jpg`, `avatar-2.jpg`, etc.
3. Kích thước khuyến nghị: 200x200px hoặc 400x400px
4. Các avatar sẽ tự động hiển thị trong trang profile

## Cập nhật danh sách avatar:

Sau khi thêm file mới, cần cập nhật danh sách `AVAILABLE_AVATARS` trong file `app/(main)/profile/page.tsx`:

```typescript
const AVAILABLE_AVATARS: AvatarOption[] = [
  { id: '1', url: '/avatars/avatar-1.jpg' },
  { id: '2', url: '/avatars/avatar-2.jpg' },
  // ... thêm các avatar mới vào đây
];
```

## Hiển thị avatar:

- Mặc định hiển thị 5 avatar đầu tiên
- Card thứ 6 là nút "Mở rộng" (+)
- Khi mở rộng, hiển thị tất cả avatar + nút "Thu gọn" (-)
- Người dùng có thể chọn bất kỳ avatar nào

## Lưu ý:

- Chỉ sử dụng ảnh phù hợp và an toàn cho mọi lứa tuổi
- Kích thước file nên < 500KB để tối ưu hiệu suất
- Nên sử dụng định dạng JPG hoặc WebP để giảm dung lượng

