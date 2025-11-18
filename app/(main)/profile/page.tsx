"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import AvatarSection from "./components/AvatarSection";
import AccountInfoSection from "./components/AccountInfoSection";
import ChangePasswordSection from "./components/ChangePasswordSection";
import DeleteAccountModal from "./components/DeleteAccountModal";
import ForgotPasswordModal from "./components/ForgotPasswordModal";
import EditAccountModal from "./components/EditAccountModal";

type AvatarOption = {
  id: string;
  url: string;
};

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [expandedAvatars, setExpandedAvatars] = useState(false);
  const [saving, setSaving] = useState(false);

  // Thông tin tài khoản
  const [enrolledCoursesCount, setEnrolledCoursesCount] = useState(0);

  // Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Xóa tài khoản
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Quên mật khẩu
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  // Thay đổi thông tin tài khoản
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.replace(ROUTES.LOGIN);
      return;
    }
    
    const loadData = async () => {
      setFullName(user.user_metadata?.full_name || "");
      setSelectedAvatar(user.user_metadata?.avatar_url || "");

      // Load enrolled courses count
      const { data: enrolledCourses } = await supabase
        .from("user_courses")
        .select("course_id")
        .eq("user_id", user.id);
      setEnrolledCoursesCount(enrolledCourses?.length || 0);

      setLoading(false);
    };
    loadData();
  }, [user, authLoading, router, supabase]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // 1. Update user metadata trong Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          avatar_url: selectedAvatar,
        },
      });

      if (authError) {
        console.error("Error updating user metadata:", authError);
        alert("Cập nhật thông tin thất bại. Vui lòng thử lại.");
        return;
      }

      // 2. Sync avatar và full_name vào bảng profiles trong database
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName || null,
          avatar_url: selectedAvatar || null,
        })
        .eq("id", user.id);

      if (profileError) {
        console.error("Error updating profiles table:", profileError);
        // Vẫn tiếp tục vì metadata đã được update
      }

      // Refresh auth context to get updated user data
      await refreshProfile();
      
      setShowAvatarSelector(false);
      setIsChangingAvatar(false);
      alert("Cập nhật thông tin thành công!");
      // Dispatch event to notify Header
      window.dispatchEvent(new CustomEvent("profile-updated"));
    } catch (error) {
      console.error("Error:", error);
      alert("Cập nhật thông tin thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAvatar = (avatar: AvatarOption) => {
    setSelectedAvatar(avatar.url);
    setIsChangingAvatar(true);
  };

  const handleChangePassword = async () => {
    if (!user?.email) {
      alert("Không tìm thấy thông tin người dùng");
      return;
    }
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Mật khẩu mới không khớp");
      return;
    }
    if (newPassword === currentPassword) {
      alert("Mật khẩu mới phải khác mật khẩu cũ");
      return;
    }

    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        alert("Mật khẩu hiện tại không đúng");
        setChangingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        alert("Đổi mật khẩu thất bại. Vui lòng thử lại.");
      } else {
        alert("Đổi mật khẩu thành công!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      alert("Đổi mật khẩu thất bại. Vui lòng thử lại.");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.email || !user?.id) {
      alert("Không tìm thấy thông tin người dùng");
      return;
    }
    
    if (!deletePassword) {
      alert("Vui lòng nhập mật khẩu để xác nhận");
      return;
    }

    setDeleting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: deletePassword,
      });

      if (signInError) {
        alert("Mật khẩu không đúng");
        setDeleting(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (deleteError) {
        alert("Xóa tài khoản thất bại. Vui lòng thử lại.");
      } else {
        await supabase.auth.signOut();
        router.replace(ROUTES.LOGIN);
      }
    } catch (error) {
      alert("Xóa tài khoản thất bại. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSendPasswordResetOTP = async () => {
    if (!user?.email) {
      alert("Không tìm thấy email người dùng");
      return;
    }
    
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}${ROUTES.RESET_PASSWORD}`,
      });

      if (error) {
        alert("Gửi email thất bại. Vui lòng thử lại.");
      } else {
        alert("Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.");
        setShowForgotPasswordModal(false);
      }
    } catch (error) {
      alert("Gửi email thất bại. Vui lòng thử lại.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOpenEditAccountModal = () => {
    if (!user) return;
    
    setEditUsername(user.user_metadata?.username || "");
    setEditFullName(fullName);
    setEditEmail(user.email || "");
    setShowEditAccountModal(true);
  };

  const handleSaveAccountInfo = async () => {
    if (!user?.id || !user?.email) {
      alert("Không tìm thấy thông tin người dùng");
      return;
    }
    
    if (!editFullName || !editEmail) {
      alert("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setSavingAccount(true);
    try {
      const updates: any = {
        data: {
          full_name: editFullName,
        },
      };

      if (editEmail !== user.email) {
        updates.email = editEmail;
      }

      const { error: authError } = await supabase.auth.updateUser(updates);

      if (authError) {
        alert("Cập nhật thông tin thất bại. Vui lòng thử lại.");
        return;
      }

      // Sync full_name và email vào bảng profiles
      const profileUpdates: any = {
        full_name: editFullName || null,
        email: editEmail,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", user.id);

      if (profileError) {
        console.error("Error updating profiles table:", profileError);
        // Vẫn tiếp tục vì metadata đã được update
      }

      if (editEmail !== user.email) {
        alert(
          "Thông tin đã được cập nhật. Vui lòng kiểm tra email mới để xác nhận."
        );
      } else {
        alert("Cập nhật thông tin thành công!");
      }

      // Refresh auth context
      await refreshProfile();

      setShowEditAccountModal(false);
      window.dispatchEvent(new CustomEvent("profile-updated"));
    } catch (error) {
      alert("Cập nhật thông tin thất bại. Vui lòng thử lại.");
    } finally {
      setSavingAccount(false);
    }
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
      <h1 className="text-2xl font-semibold mb-6">Tài khoản cá nhân</h1>

      {/* Phần 1: Avatar Section */}
      <AvatarSection
        selectedAvatar={selectedAvatar}
        fullName={fullName}
        userEmail={user?.email || ""}
        onSelectAvatar={handleSelectAvatar}
        isChangingAvatar={isChangingAvatar}
        showAvatarSelector={showAvatarSelector}
        onToggleAvatarSelector={() =>
          setShowAvatarSelector(!showAvatarSelector)
        }
        expandedAvatars={expandedAvatars}
        onToggleExpandedAvatars={() => setExpandedAvatars(!expandedAvatars)}
        onFullNameChange={setFullName}
        onSaveProfile={handleSaveProfile}
        saving={saving}
      />

      {/* Phần 2: Thông tin tài khoản */}
      <AccountInfoSection
        user={user}
        fullName={fullName}
        enrolledCoursesCount={enrolledCoursesCount}
        onEditAccount={handleOpenEditAccountModal}
        onDeleteAccount={() => setShowDeleteModal(true)}
      />

      {/* Phần 3: Thay đổi mật khẩu */}
      <ChangePasswordSection
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        changingPassword={changingPassword}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onChangePassword={handleChangePassword}
        onForgotPassword={() => setShowForgotPasswordModal(true)}
      />

      {/* Modals */}
      <DeleteAccountModal
        show={showDeleteModal}
        deletePassword={deletePassword}
        deleting={deleting}
        onPasswordChange={setDeletePassword}
        onConfirm={handleDeleteAccount}
        onCancel={() => {
          setShowDeleteModal(false);
          setDeletePassword("");
        }}
      />

      <ForgotPasswordModal
        show={showForgotPasswordModal}
        userEmail={user?.email || ""}
        sendingOtp={sendingOtp}
        onConfirm={handleSendPasswordResetOTP}
        onCancel={() => setShowForgotPasswordModal(false)}
      />

      <EditAccountModal
        show={showEditAccountModal}
        username={editUsername}
        fullName={editFullName}
        email={editEmail}
        saving={savingAccount}
        onUsernameChange={setEditUsername}
        onFullNameChange={setEditFullName}
        onEmailChange={setEditEmail}
        onSave={handleSaveAccountInfo}
        onCancel={() => setShowEditAccountModal(false)}
      />
    </div>
  );
}
