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
  
  // Thông tin tài khoản
  const [enrolledCoursesCount, setEnrolledCoursesCount] = useState(0);
  
  // Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Xóa tài khoản
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Quên mật khẩu
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  
  // Thay đổi thông tin tài khoản
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

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
      
      // Load enrolled courses count
      const { data: enrolledCourses } = await supabase
        .from('user_courses')
        .select('course_id')
        .eq('user_id', user.id);
      setEnrolledCoursesCount(enrolledCourses?.length || 0);
      
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

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Mật khẩu mới không khớp');
      return;
    }
    if (newPassword === currentPassword) {
      alert('Mật khẩu mới phải khác mật khẩu cũ');
      return;
    }

    setChangingPassword(true);
    try {
      // Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      
      if (signInError) {
        alert('Mật khẩu hiện tại không đúng');
        setChangingPassword(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        alert('Đổi mật khẩu thất bại. Vui lòng thử lại.');
      } else {
        alert('Đổi mật khẩu thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      alert('Đổi mật khẩu thất bại. Vui lòng thử lại.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      alert('Vui lòng nhập mật khẩu để xác nhận');
      return;
    }

    setDeleting(true);
    try {
      // Verify password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });
      
      if (signInError) {
        alert('Mật khẩu không đúng');
        setDeleting(false);
        return;
      }

      // Delete user from profiles table (cascade will handle related data)
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (deleteError) {
        alert('Xóa tài khoản thất bại. Vui lòng thử lại.');
      } else {
        // Sign out and redirect
        await supabase.auth.signOut();
        router.replace(ROUTES.LOGIN);
      }
    } catch (error) {
      alert('Xóa tài khoản thất bại. Vui lòng thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  const handleForgotPassword = async () => {
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}${ROUTES.RESET_PASSWORD}`,
      });

      if (error) {
        alert('Gửi email thất bại. Vui lòng thử lại.');
      } else {
        alert('Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.');
        setShowForgotPasswordModal(false);
      }
    } catch (error) {
      alert('Gửi email thất bại. Vui lòng thử lại.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOpenEditAccount = () => {
    setEditUsername(user?.email?.split('@')[0] || '');
    setEditFullName(fullName);
    setEditEmail(user?.email || '');
    setShowEditAccountModal(true);
  };

  const handleSaveAccountInfo = async () => {
    if (!editFullName || !editEmail) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setSavingAccount(true);
    try {
      // Update full name in metadata
      const updates: any = {
        data: {
          full_name: editFullName,
        }
      };

      // Update email if changed
      if (editEmail !== user.email) {
        updates.email = editEmail;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) {
        alert('Cập nhật thông tin thất bại. Vui lòng thử lại.');
      } else {
        if (editEmail !== user.email) {
          alert('Thông tin đã được cập nhật. Vui lòng kiểm tra email mới để xác nhận.');
        } else {
          alert('Cập nhật thông tin thành công!');
        }
        
        // Reload user data
        const { data: { user: updatedUser } } = await supabase.auth.getUser();
        if (updatedUser) {
          setUser(updatedUser);
          setFullName(updatedUser.user_metadata?.full_name || '');
        }
        
        setShowEditAccountModal(false);
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
    } catch (error) {
      alert('Cập nhật thông tin thất bại. Vui lòng thử lại.');
    } finally {
      setSavingAccount(false);
    }
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
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-6">Hồ sơ học tập</h1>
      
      {/* Phần 1: Avatar Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-2xl mx-auto">
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
      </div>

      {/* Phần 2: Thông tin tài khoản */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Thông tin tài khoản</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Tên đăng nhập</label>
            <p className="text-gray-800">{user?.email?.split('@')[0] || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Email</label>
            <p className="text-gray-800">{user?.email || '-'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Tên tài khoản</label>
            <p className="text-gray-800">{fullName || 'Chưa cập nhật'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Ngày tạo tài khoản</label>
            <p className="text-gray-800">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '-'}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Số khóa học đã đăng ký</label>
            <p className="text-gray-800">{enrolledCoursesCount} khóa học</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={handleOpenEditAccount}
            className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors"
          >
            Thay đổi thông tin tài khoản
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Xóa tài khoản
          </button>
        </div>
      </div>

      {/* Phần 3: Thay đổi mật khẩu */}
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
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed transition-colors"
            >
              {changingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
            <button
              onClick={() => setShowForgotPasswordModal(true)}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Quên mật khẩu
            </button>
          </div>
        </div>
      </div>

      {/* Modal Xác nhận xóa tài khoản */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Xác nhận xóa tài khoản</h3>
            <p className="text-gray-600 mb-4">
              Hành động này không thể hoàn tác. Vui lòng nhập mật khẩu để xác nhận.
            </p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="w-full rounded-md border border-gray-300 px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleDeleteAccount();
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Đang xóa...' : 'Xóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Quên Mật Khẩu */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Quên mật khẩu</h3>
            <p className="text-gray-600 mb-4">
              Chúng tôi sẽ gửi link đặt lại mật khẩu đến email: <strong>{user?.email}</strong>
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowForgotPasswordModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleForgotPassword}
                disabled={sendingOtp}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed transition-colors"
              >
                {sendingOtp ? 'Đang gửi...' : 'Gửi email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thay Đổi Thông Tin Tài Khoản */}
      {showEditAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Thay đổi thông tin tài khoản</h3>
            
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên đăng nhập (chỉ hiển thị)
                </label>
                <input
                  type="text"
                  value={editUsername}
                  disabled
                  className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Tên đăng nhập không thể thay đổi</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên tài khoản
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Nhập tên tài khoản"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Nhập email"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email mới cần xác nhận qua link gửi đến hộp thư
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowEditAccountModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveAccountInfo}
                disabled={savingAccount}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed transition-colors"
              >
                {savingAccount ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
