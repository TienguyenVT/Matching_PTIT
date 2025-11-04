"use client";

interface AccountInfoSectionProps {
  user: any;
  fullName: string;
  enrolledCoursesCount: number;
  onEditAccount: () => void;
  onDeleteAccount: () => void;
}

export default function AccountInfoSection({
  user,
  fullName,
  enrolledCoursesCount,
  onEditAccount,
  onDeleteAccount,
}: AccountInfoSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-5 bg-red-500 rounded flex-shrink-0"></div>
        <h1 className="text-xl font-semibold text-gray-800">Thông tin tài khoản</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Tên đăng nhập
          </label>
          <p className="text-gray-800">{user?.email?.split("@")[0] || "-"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Email
          </label>
          <p className="text-gray-800">{user?.email || "-"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Tên tài khoản
          </label>
          <p className="text-gray-800">{fullName || "Chưa cập nhật"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Ngày tạo tài khoản
          </label>
          <p className="text-gray-800">
            {user?.created_at
              ? new Date(user.created_at).toLocaleDateString("vi-VN")
              : "-"}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 block mb-1">
            Số khóa học đã đăng ký
          </label>
          <p className="text-gray-800">{enrolledCoursesCount} khóa học</p>
        </div>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={onEditAccount}
          className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
        >
          Thay đổi thông tin tài khoản
        </button>
        <button
          onClick={onDeleteAccount}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Xóa tài khoản
        </button>
      </div>
    </div>
  );
}

