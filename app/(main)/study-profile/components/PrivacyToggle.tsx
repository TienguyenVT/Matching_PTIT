"use client";

interface PrivacyToggleProps {
  value: boolean;
  onChange: (newValue: boolean) => void;
}

export default function PrivacyToggle({ value, onChange }: PrivacyToggleProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Cài đặt quyền riêng tư
          </h3>
          <p className="text-sm text-gray-600">
            {value
              ? "Tiến độ học tập của bạn đang được công khai. Người dùng khác có thể xem tiến độ học tập của bạn."
              : "Tiến độ học tập của bạn đang được ẩn. Chỉ bạn mới có thể xem tiến độ học tập."}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>
    </div>
  );
}

