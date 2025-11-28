"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

type UserProfile = {
    id: string;
    username: string | null;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
};

export default function AllMemberPage() {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [matchingUser, setMatchingUser] = useState<string | null>(null);
    useEffect(() => {
        const fetchAllUsers = async () => {
            try {
                setLoading(true);
                const { data: { user: currentUser } } = await supabaseBrowser().auth.getUser();

                if (!currentUser) {
                    setError("Vui lòng đăng nhập để xem danh sách thành viên");
                    return;
                }

                const { data: users, error: fetchError } = await supabaseBrowser()
                    .from('profiles')
                    .select('id, username, full_name, email, avatar_url')
                    .neq('id', currentUser.id)
                    .order('full_name', { ascending: true });

                if (fetchError) throw fetchError;

                setUsers(users || []);
            } catch (err) {
                console.error("Lỗi khi tải danh sách thành viên:", err);
                setError("Đã xảy ra lỗi khi tải danh sách thành viên. Vui lòng thử lại sau.");
            } finally {
                setLoading(false);
            }
        };

        fetchAllUsers();
    }, []);

    if (error) {
        return (
            <div className="p-6">
                <h1 className="text-2xl font-bold">Danh sách thành viên</h1>
                <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
                    {error}
                </div>
            </div>
        );
    }
    return (
        <div className="p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold">Danh sách thành viên</h1>
                <p className="mt-2 text-gray-600">
                    {loading ? 'Đang tải...' : `Tổng số thành viên: ${users.length}`}
                </p>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-4 w-1/2" />
                            </div>
                            <Skeleton className="h-8 w-20" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    {users.map((user) => (
                        <div
                            key={user.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            {/* User info */}
                            <div className="flex items-center space-x-4">
                                <Avatar>
                                    <AvatarImage src={user.avatar_url || ''} alt={user.full_name || ''} />
                                    <AvatarFallback>
                                        {user.full_name?.charAt(0) ||
                                            user.email?.charAt(0).toUpperCase() ||
                                            'U'}
                                    </AvatarFallback>
                                </Avatar>

                                <div>
                                    <h3 className="font-medium">
                                        {user.full_name || 'Người dùng ẩn danh'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {user.username || user.email?.split('@')[0]}
                                    </p>
                                </div>
                            </div>

                            {/* Button ghép đôi */}
                            <button
                                className={`px-4 py-2 ${matchingUser === user.id ? 'bg-green-600' : 'bg-primary'} text-white rounded-md hover:opacity-90 transition disabled:opacity-50`}
                                onClick={async () => {
                                    try {
                                        setMatchingUser(user.id);
                                        const { data: { user: currentUser } } = await supabaseBrowser().auth.getUser();

                                        // Insert a new notification for the matched user
                                        const { error } = await supabaseBrowser()
                                            .from('notifications')
                                            .insert([
                                                {
                                                    user_id: user.id,
                                                    title: 'Yêu cầu ghép đôi',
                                                    message: `${currentUser?.user_metadata?.full_name || 'Ai đó'} muốn ghép đôi với bạn`,
                                                    type: 'match_request',
                                                    read: false,
                                                    metadata: { from_user: currentUser?.id }
                                                }
                                            ]);

                                        if (error) throw error;

                                        toast.success(`Đã gửi yêu cầu ghép đôi đến ${user.full_name}`);

                                        // Reset the button state after 3 seconds
                                        setTimeout(() => setMatchingUser(null), 3000);
                                    } catch (err) {
                                        console.error('Lỗi khi gửi yêu cầu ghép đôi:', err);
                                        toast.error('Có lỗi xảy ra khi gửi yêu cầu');
                                        setMatchingUser(null);
                                    }
                                }}
                                disabled={!!matchingUser}
                            >
                                {matchingUser === user.id ? 'Đã gửi yêu cầu ✓' : 'Ghép đôi'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}