"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { ROUTES } from "@/lib/routes";

type Notification = {
    id: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    type: string;
    metadata: {
        status?: 'pending' | 'accepted' | 'rejected';
        from_user?: string;
    };
};

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const supabase = supabaseBrowser();

    useEffect(() => {
        if (!user) return;

        const loadNotifications = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setNotifications(data || []);
            } catch (err) {
                console.error('Lỗi khi tải thông báo:', err);
                toast.error('Có lỗi xảy ra khi tải thông báo');
            } finally {
                setLoading(false);
            }
        };

        loadNotifications();

        // Set up real-time subscription
        const channel = supabase
            .channel('notifications')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    setNotifications(prev => [newNotification, ...prev]);

                    if (newNotification.type === 'match_request') {
                        toast.success('Bạn có yêu cầu ghép đôi mới!');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const markAsRead = async (id: string) => {
        try {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('id', id);

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
        } catch (err) {
            console.error('Lỗi khi đánh dấu đã đọc:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await supabase
                .from('notifications')
                .update({ read: true })
                .eq('user_id', user?.id)
                .eq('read', false);

            setNotifications(prev =>
                prev.map(n => ({ ...n, read: true }))
            );
        } catch (err) {
            console.error('Lỗi khi đánh dấu tất cả đã đọc:', err);
        }
    };
    const handleMatchAction = async (notificationId: string, action: 'accept' | 'reject', senderId: string) => {
        try {
            // Lấy thông tin người dùng hiện tại
            const { data: currentUser } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user?.id)
                .single();

            // Lấy thông tin người gửi yêu cầu
            const { data: senderData } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', senderId)
                .single();

            if (action === 'accept') {
                // Xử lý khi chấp nhận
                await supabase
                    .from('notifications')
                    .update({
                        read: true,
                        metadata: {
                            ...notifications.find(n => n.id === notificationId)?.metadata,
                            status: 'accepted'
                        }
                    })
                    .eq('id', notificationId);
                await supabase
                    .from('conversations')
                    .upsert(
                        [
                            {
                                user1_id: user?.id,
                                user2_id: senderId,
                                last_message: 'Bắt đầu trò chuyện',
                                updated_at: new Date().toISOString()
                            }
                        ],
                        { onConflict: 'user1_id,user2_id' }
                    );
                // Gửi thông báo chấp nhận cho người gửi yêu cầu
                await supabase
                    .from('notifications')
                    .insert({
                        user_id: senderId,
                        title: 'Yêu cầu ghép đôi được chấp nhận',
                        message: `${currentUser?.full_name || 'Ai đó'} đã chấp nhận lời mời ghép đôi!`,
                        type: 'system',
                        read: false,
                        metadata: {
                            status: 'accepted',
                            from_user: user?.id
                        }
                    });
            } else {
                // Xử lý khi từ chối
                await supabase
                    .from('notifications')
                    .update({
                        read: true,
                        metadata: {
                            ...notifications.find(n => n.id === notificationId)?.metadata,
                            status: 'rejected'
                        }
                    })
                    .eq('id', notificationId);

                // Gửi thông báo từ chối cho người gửi yêu cầu
                const { error: rejectError } = await supabase
                    .from('notifications')
                    .insert({
                        user_id: senderId, // Gửi về cho người đã gửi yêu cầu
                        title: 'Yêu cầu ghép đôi bị từ chối',
                        message: `${currentUser?.full_name || 'Ai đó'} đã từ chối lời mời ghép đôi của bạn.`,
                        type: 'system',
                        read: false,
                        metadata: {
                            status: 'rejected',
                            from_user: user?.id
                        }
                    });

                if (rejectError) {
                    console.error('Lỗi khi gửi thông báo từ chối:', rejectError);
                    throw rejectError;
                }
            }

            // Cập nhật UI
            setNotifications(prev =>
                prev.map(n =>
                    n.id === notificationId
                        ? {
                            ...n,
                            read: true,
                            metadata: {
                                ...n.metadata,
                                status: action === 'accept' ? 'accepted' : 'rejected'
                            }
                        }
                        : n
                )
            );

            toast.success(`Đã ${action === 'accept' ? 'chấp nhận' : 'từ chối'} yêu cầu ghép đôi`);

        } catch (err) {
            console.error('Lỗi khi xử lý yêu cầu ghép đôi:', err);
            toast.error('Có lỗi xảy ra khi xử lý yêu cầu');
        }
    };
    const renderNotificationContent = (notification: Notification) => {
        const isMatchRequest = notification.type === 'match_request';
        const isProcessed = notification.metadata?.status === 'accepted' || notification.metadata?.status === 'rejected';

        return (
            <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900">
                    {notification.title}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                    {notification.message}
                </p>
                {isMatchRequest && !isProcessed && (
                    <div className="mt-2 flex space-x-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMatchAction(
                                    notification.id,
                                    'accept',
                                    notification.metadata?.from_user || ''
                                );
                            }}
                            className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200"
                        >
                            Chấp nhận
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMatchAction(
                                    notification.id,
                                    'reject',
                                    notification.metadata?.from_user || ''
                                );
                            }}
                            className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded hover:bg-red-200"
                        >
                            Từ chối
                        </button>
                    </div>
                )}
                {isMatchRequest && isProcessed && (
                    <p className="mt-1 text-xs text-gray-500">
                        {notification.metadata?.status === 'accepted'
                            ? 'Bạn đã chấp nhận yêu cầu này'
                            : 'Bạn đã từ chối yêu cầu này'}
                    </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                    {new Date(notification.created_at).toLocaleString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </p>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-6">Thông báo</h1>
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="p-4 border rounded-lg">
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-3 w-1/4 mt-2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Thông báo</h1>
                {notifications.some(n => !n.read) && (
                    <button
                        onClick={markAllAsRead}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        Đánh dấu tất cả đã đọc
                    </button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="text-center py-12">
                    <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                        />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Không có thông báo</h3>
                    <p className="mt-1 text-sm text-gray-500">Bạn chưa có thông báo nào</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`p-4 border rounded-lg ${!notification.read ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-gray-50'}`}
                            onClick={() => !notification.read && markAsRead(notification.id)}
                        >
                            <div className="flex items-start">
                                <div className="flex-shrink-0 pt-0.5">
                                    {!notification.read && (
                                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                    )}
                                </div>
                                {renderNotificationContent(notification)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}