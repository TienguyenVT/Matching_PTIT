"use client";

interface DeleteAccountModalProps {
  show: boolean;
  deletePassword: string;
  deleting: boolean;
  onPasswordChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteAccountModal({
  show,
  deletePassword,
  deleting,
  onPasswordChange,
  onConfirm,
  onCancel,
}: DeleteAccountModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Xác nhận xóa tài khoản</h3>
        <p className="text-gray-600 mb-4">
          Hành động này không thể hoàn tác. Vui lòng nhập mật khẩu để xác nhận.
        </p>
        <input
          type="password"
          value={deletePassword}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Nhập mật khẩu"
          className="w-full rounded-md border border-gray-300 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
          onKeyPress={(e) => {
            if (e.key === "Enter") {
              onConfirm();
            }
          }}
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? "Đang xóa..." : "Xóa tài khoản"}
          </button>
        </div>
      </div>
    </div>
  );
}

