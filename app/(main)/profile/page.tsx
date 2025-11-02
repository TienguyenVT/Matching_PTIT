"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
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
  const [user, setUser] = useState<any>(null);
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
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace(ROUTES.LOGIN);
        return;
      }
      setUser(user);
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
        },
      });

      if (error) {
        console.error("Error updating profile:", error);
        alert("Cập nhật thông tin thất bại. Vui lòng thử lại.");
      } else {
        alert("Cập nhật thông tin thành công!");
        const {
          data: { user: updatedUser },
        } = await supabase.auth.getUser();
        if (updatedUser) {
          setUser(updatedUser);
        }
        setShowAvatarSelector(false);
        window.dispatchEvent(new CustomEvent("profile-updated"));
      }
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

  const handleForgotPassword = async () => {
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

  const handleOpenEditAccount = () => {
    setEditUsername(user?.email?.split("@")[0] || "");
    setEditFullName(fullName);
    setEditEmail(user?.email || "");
    setShowEditAccountModal(true);
  };

  const handleSaveAccountInfo = async () => {
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

      const { error } = await supabase.auth.updateUser(updates);

      if (error) {
        alert("Cập nhật thông tin thất bại. Vui lòng thử lại.");
      } else {
        if (editEmail !== user.email) {
          alert(
            "Thông tin đã được cập nhật. Vui lòng kiểm tra email mới để xác nhận."
          );
        } else {
          alert("Cập nhật thông tin thành công!");
        }

        const {
          data: { user: updatedUser },
        } = await supabase.auth.getUser();
        if (updatedUser) {
          setUser(updatedUser);
          setFullName(updatedUser.user_metadata?.full_name || "");
        }

        setShowEditAccountModal(false);
        window.dispatchEvent(new CustomEvent("profile-updated"));
      }
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
      <h1 className="text-2xl font-semibold mb-6">Hồ sơ học tập</h1>

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
      />

      {/* Phần 2: Thông tin tài khoản */}
      <AccountInfoSection
        user={user}
        fullName={fullName}
        enrolledCoursesCount={enrolledCoursesCount}
        onEditAccount={handleOpenEditAccount}
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
        userEmail={user?.email}
        sendingOtp={sendingOtp}
        onConfirm={handleForgotPassword}
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
