"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

type Message = {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    read: boolean;
    created_at: string;
    sender_profile?: {
        full_name: string;
        avatar_url?: string;
    };
};

type Conversation = {
    id: string;
    user_id: string;
    full_name: string;
    avatar_url?: string;
    last_message?: string;
    unread_count: number;
    updated_at: string;
};

export default function MessagesPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
                </div>
            }
        >
            <MessagesPageContent />
        </Suspense>
    );
}

function MessagesPageContent() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();
    const supabase = createClientComponentClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryUserId = searchParams.get("user");

    const updateConversationsList = useCallback(
        async (userId: string, lastMessage: string) => {
            try {
                let exists = false;

                setConversations((prev) => {
                    const existingConversation = prev.find((c) => c.user_id === userId);

                    if (existingConversation) {
                        exists = true;
                        const updated = prev
                            .map((c) =>
                                c.user_id === userId
                                    ? {
                                          ...c,
                                          last_message: lastMessage,
                                          unread_count:
                                              c.user_id === selectedConversation
                                                  ? 0
                                                  : c.unread_count + 1,
                                          updated_at: new Date().toISOString(),
                                      }
                                    : c
                            )
                            .sort(
                                (a, b) =>
                                    new Date(b.updated_at).getTime() -
                                    new Date(a.updated_at).getTime()
                            );

                        return updated;
                    }

                    return prev;
                });

                if (!exists) {
                    const { data: userData, error: userError } = await supabase
                        .from("profiles")
                        .select("full_name, avatar_url")
                        .eq("id", userId)
                        .single();

                    if (userError) throw userError;

                    setConversations((prev) => [
                        {
                            id: userId,
                            user_id: userId,
                            full_name: userData.full_name,
                            avatar_url: userData.avatar_url,
                            last_message: lastMessage,
                            unread_count: 1,
                            updated_at: new Date().toISOString(),
                        },
                        ...prev,
                    ]);
                }
            } catch (error) {
                console.error("Error updating conversations list:", error);
            }
        },
        [selectedConversation, supabase]
    );

    const markMessagesAsRead = useCallback(
        async (senderId: string) => {
            if (!user) return;

            try {
                await supabase
                    .from("messages")
                    .update({ read: true })
                    .eq("sender_id", senderId)
                    .eq("receiver_id", user.id)
                    .eq("read", false);

                setConversations((prev) =>
                    prev.map((c) =>
                        c.user_id === senderId
                            ? {
                                  ...c,
                                  unread_count: 0,
                              }
                            : c
                    )
                );
            } catch (error) {
                console.error("Error marking messages as read:", error);
            }
        },
        [supabase, user?.id]
    );

    // Fetch conversations
    useEffect(() => {
        if (!user) return;

        const fetchConversations = async () => {
            try {
                setLoading(true);
                const { data: conversationsData, error: conversationsError } = await supabase
                    .rpc("get_user_conversations", { p_user_id: user.id });

                if (conversationsError) throw conversationsError;
                const list = conversationsData || [];
                setConversations(list);

                // Chọn cuộc trò chuyện ban đầu
                if (list.length > 0 && !selectedConversation) {
                    // Ưu tiên userId từ query (?user=...)
                    const hasQueryUser =
                        queryUserId && list.some((c: Conversation) => c.user_id === queryUserId);
                    const targetId = hasQueryUser ? queryUserId! : list[0].user_id;
                    setSelectedConversation(targetId);
                }
            } catch (error) {
                console.error("Error fetching conversations:", error);
                toast.error("Lỗi khi tải danh sách trò chuyện");
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();

        // Set up real-time subscription for new messages
        const channel = supabase
            .channel("messages")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `receiver_id=eq.${user.id}`,
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    setMessages((prev) => [...prev, newMessage]);
                    scrollToBottom();

                    // Update conversations list
                    updateConversationsList(newMessage.sender_id, newMessage.content);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, selectedConversation, queryUserId, supabase, updateConversationsList]);

    // Fetch messages for selected conversation
    useEffect(() => {
        if (!selectedConversation || !user) return;

        const fetchMessages = async () => {
            try {
                setLoading(true);
                const { data: messagesData, error: messagesError } = await supabase
                    .from("messages")
                    .select("*")
                    .or(
                        `and(sender_id.eq.${user.id},receiver_id.eq.${selectedConversation}),and(sender_id.eq.${selectedConversation},receiver_id.eq.${user.id})`
                    )
                    .order("created_at", { ascending: true });

                if (messagesError) throw messagesError;
                setMessages(messagesData || []);

                // Mark messages as read
                await markMessagesAsRead(selectedConversation);

                scrollToBottom();
            } catch (error) {
                console.error("Error fetching messages:", error);
                toast.error("Lỗi khi tải tin nhắn");
            } finally {
                setLoading(false);
            }
        };

        fetchMessages();
    }, [selectedConversation, user?.id, supabase, markMessagesAsRead]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation || !user) return;

        try {
            const { data, error } = await supabase
                .from("messages")
                .insert([
                    {
                        sender_id: user.id,
                        receiver_id: selectedConversation,
                        content: newMessage.trim(),
                        read: false,
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            setNewMessage("");
            setMessages((prev) => [...prev, data]);

            updateConversationsList(selectedConversation, data.content);
            scrollToBottom();
        } catch (error) {
            console.error("Error sending message:", error);
            toast.error("Lỗi khi gửi tin nhắn");
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase();
    }

    if (loading && !selectedConversation) {
        return (
            <div className="soft-page p-4 md:p-8">
                <div className="soft-page-inner flex items-center justify-center min-h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="soft-page p-2 md:p-4">
            <div className="soft-page-inner">
                <div className="flex h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)] gap-3 md:gap-4">
                    {/* Sidebar */}
                    <div className="w-72 md:w-80 flex flex-col soft-card overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-white/70">
                            <h2 className="text-lg md:text-xl font-semibold">Tin nhắn</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto">

                            {conversations.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    Không có cuộc trò chuyện nào
                                </div>
                            ) : (
                                conversations.map((conversation) => (
                                    <div
                                        key={conversation.user_id}
                                        className={`flex items-center p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                                            selectedConversation === conversation.user_id ? "bg-red-50" : ""
                                        }`}
                                        onClick={() => setSelectedConversation(conversation.user_id)}
                                    >
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={conversation.avatar_url || ""} />
                                            <AvatarFallback>{getInitials(conversation.full_name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="ml-3 flex-1 min-w-0">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-sm font-medium text-gray-900 truncate">
                                                    {conversation.full_name}
                                                </h3>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(conversation.updated_at).toLocaleTimeString("vi-VN", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 truncate">
                                                {conversation.last_message || "Bắt đầu trò chuyện"}
                                            </p>
                                        </div>
                                        {conversation.unread_count > 0 && (
                                            <span className="ml-2 bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full">
                                                {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col soft-card overflow-hidden">

                        {selectedConversation ? (
                            <>
                                {/* Chat Header */}
                                <div className="p-4 border-b border-gray-100 bg-white/80 flex items-center">

                                    {conversations.find((c) => c.user_id === selectedConversation) && (
                                        <>
                                            <Avatar className="h-10 w-10">
                                                <AvatarImage
                                                    src={
                                                        conversations.find((c) => c.user_id === selectedConversation)
                                                            ?.avatar_url || ""
                                                    }
                                                />
                                                <AvatarFallback>
                                                    {getInitials(
                                                        conversations.find((c) => c.user_id === selectedConversation)
                                                            ?.full_name || ""
                                                    )}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="ml-3">
                                                <h3 className="text-base font-medium text-gray-900">
                                                    {
                                                        conversations.find((c) => c.user_id === selectedConversation)
                                                            ?.full_name
                                                    }
                                                </h3>
                                                <p className="text-sm text-gray-500">Đang hoạt động</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Messages */}
                                <div className="flex-1 p-4 overflow-y-auto bg-gray-50">

                                    {messages.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-500">
                                            Bắt đầu cuộc trò chuyện mới
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {messages.map((message) => (
                                                <div
                                                    key={message.id}
                                                    className={`flex ${
                                                        message.sender_id === user?.id
                                                            ? "justify-end"
                                                            : "justify-start"
                                                    }`}
                                                >
                                                    <div
                                                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                                            message.sender_id === user?.id
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-white border border-gray-200"
                                                        }`}
                                                    >
                                                        <p className="text-sm">{message.content}</p>
                                                        <p
                                                            className={`text-xs mt-1 text-right ${
                                                                message.sender_id === user?.id
                                                                    ? "text-red-100"
                                                                    : "text-gray-400"
                                                            }`}
                                                        >
                                                            {new Date(message.created_at).toLocaleTimeString(
                                                                "vi-VN",
                                                                {
                                                                    hour: "2-digit",
                                                                    minute: "2-digit",
                                                                }
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            <div ref={messagesEndRef} />
                                        </div>
                                    )}
                                </div>

                                {/* Message Input */}
                                <div className="p-4 border-t border-gray-100 bg-white/80">

                                    <form onSubmit={handleSendMessage} className="flex space-x-2">
                                        <Input
                                            type="text"
                                            placeholder="Nhập tin nhắn..."
                                            className="flex-1"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                        />
                                        <Button type="submit" disabled={!newMessage.trim()}>
                                            Gửi
                                        </Button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-gray-50">

                                <div className="text-center p-6 max-w-sm">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
                                        <svg
                                            className="h-6 w-6 text-gray-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                            />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                                        Không có cuộc trò chuyện nào
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        Chọn một cuộc trò chuyện hoặc bắt đầu trò chuyện mới
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}