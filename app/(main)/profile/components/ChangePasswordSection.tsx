"use client";

interface ChangePasswordSectionProps {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  changingPassword: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onChangePassword: () => void;
  onForgotPassword: () => void;
}

export default function ChangePasswordSection({
  currentPassword,
  newPassword,
  confirmPassword,
  changingPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onChangePassword,
  onForgotPassword,
}: ChangePasswordSectionProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Thay đổi mật khẩu</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu hiện tại
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => onCurrentPasswordChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nhập mật khẩu hiện tại"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu mới
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nhập mật khẩu mới"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Xác nhận mật khẩu mới
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Nhập lại mật khẩu mới"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onChangePassword}
            disabled={changingPassword}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {changingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
          </button>
          <button
            onClick={onForgotPassword}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Quên mật khẩu
          </button>
        </div>
      </div>
    </div>
  );
}

