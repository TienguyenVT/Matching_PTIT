'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

type AvatarOption = {
  id: string;
  url: string;
};

const AVAILABLE_AVATARS: AvatarOption[] = [
  { id: '1', url: '/avatars/avatar-1.jpg' },
  { id: '2', url: '/avatars/avatar-2.jpg' },
  { id: '3', url: '/avatars/avatar-3.jpg' },
  { id: '4', url: '/avatars/avatar-4.jpg' },
  { id: '5', url: '/avatars/avatar-5.jpg' },
  { id: '6', url: '/avatars/avatar-6.jpg' },
  { id: '7', url: '/avatars/avatar-7.jpg' },
  { id: '8', url: '/avatars/avatar-8.jpg' },
  { id: '9', url: '/avatars/avatar-9.jpg' },
  { id: '10', url: '/avatars/avatar-10.jpg' },
  { id: '11', url: '/avatars/avatar-11.jpg' },
  { id: '12', url: '/avatars/avatar-12.jpg' },
];

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [expandedAvatars, setExpandedAvatars] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(ROUTES.LOGIN);
        return;
      }
      setUser(user);
      setFullName(user.user_metadata?.full_name || '');
      setSelectedAvatar(user.user_metadata?.avatar_url || '');
      setLoading(false);
    };
    loadUser();
  }, [supabase, router]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: selectedAvatar,
        }
      });

      if (error) {
        console.error('Error updating profile:', error);
        alert('Cập nhật thông tin thất bại. Vui lòng thử lại.');
      } else {
        alert('Cập nhật thông tin thành công!');
        // Reload user data
        const { data: { user: updatedUser } } = await supabase.auth.getUser();
        if (updatedUser) {
          setUser(updatedUser);
        }
        setShowAvatarSelector(false);
        // Dispatch custom event to notify Header
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Cập nhật thông tin thất bại. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAvatar = (avatar: AvatarOption) => {
    setSelectedAvatar(avatar.url);
    setIsChangingAvatar(true);
  };

  const getAvatarDisplay = () => {
    if (selectedAvatar) {
      return (
        <img 
          src={selectedAvatar} 
          alt="Avatar" 
          className="w-20 h-20 rounded-full object-cover"
          onError={(e) => {
            // Nếu ảnh không load được, hiển thị icon mặc định
            e.currentTarget.style.display = 'none';
            const nextSibling = e.currentTarget.nextSibling as HTMLElement;
            if (nextSibling) {
              nextSibling.style.display = 'flex';
            }
          }}
        />
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-2xl font-semibold mb-6">Hồ sơ học tập</h1>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-2xl mx-auto">
        {/* Avatar Section */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden">
              {getAvatarDisplay()}
              {!selectedAvatar && (
                <svg className="w-10 h-10 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            {isChangingAvatar && (
              <div className="absolute -bottom-1 -right-1 bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">
                ✓
              </div>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">{fullName || user?.email}</h2>
            <p className="text-gray-500 text-sm">{user?.email}</p>
          </div>
          <button
            onClick={() => setShowAvatarSelector(!showAvatarSelector)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            {showAvatarSelector ? 'Đóng' : 'Đổi avatar'}
          </button>
        </div>

        {/* Avatar Selector */}
        {showAvatarSelector && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Thay đổi ảnh đại diện</h3>
            <div className="grid grid-cols-6 gap-3">
              {(expandedAvatars ? AVAILABLE_AVATARS : AVAILABLE_AVATARS.slice(0, 5)).map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => handleSelectAvatar(avatar)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedAvatar === avatar.url 
                      ? 'border-green-500 ring-2 ring-green-200' 
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <img 
                    src={avatar.url} 
                    alt={`Avatar ${avatar.id}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback nếu ảnh không tồn tại
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="30" text-anchor="middle" dominant-baseline="middle"%3E%3F%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  {selectedAvatar === avatar.url && (
                    <div className="absolute inset-0 bg-green-500 bg-opacity-20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
              {/* Button Expand/Collapse */}
              {!expandedAvatars ? (
                <button
                  onClick={() => setExpandedAvatars(true)}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 transition-all bg-gray-50 flex items-center justify-center"
                >
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => setExpandedAvatars(false)}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-gray-400 transition-all bg-gray-50 flex items-center justify-center"
                >
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Nhập họ và tên"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-50 cursor-not-allowed"
            />
          </div>

          <div className="pt-4">
            <button 
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
