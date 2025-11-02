"use client";

interface ForgotPasswordModalProps {
  show: boolean;
  userEmail: string;
  sendingOtp: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ForgotPasswordModal({
  show,
  userEmail,
  sendingOtp,
  onConfirm,
  onCancel,
}: ForgotPasswordModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Quên mật khẩu</h3>
        <p className="text-gray-600 mb-4">
          Chúng tôi sẽ gửi link đặt lại mật khẩu đến email:{" "}
          <strong>{userEmail}</strong>
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={sendingOtp}
            className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed transition-colors"
          >
            {sendingOtp ? "Đang gửi..." : "Gửi email"}
          </button>
        </div>
      </div>
    </div>
  );
}

