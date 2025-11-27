'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';

export default function MatchPage({ params }: { params: { courseId: string } }) {
  const courseId = params.courseId;
  const supabase = supabaseBrowser();
  const { user } = useAuth(); // ✅ Use shared state
  const userId = user?.id ?? null; // ✅ Get userId from shared state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'matching' | 'open' | 'matched'>('idle');
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!roomId) return;
    let ignore = false;
    const load = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender_id, content, type, created_at')
        .eq('room_id', roomId)
        .order('created_at');
      if (!ignore) setMessages(data ?? []);
    };
    load();

    const sub = supabase
      .channel(`chat:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new as any]);
      })
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(sub);
    };
  }, [roomId, supabase]);

  const onMatch = async () => {
    setStatus('matching');
    // Lấy session để gửi Bearer token cho API match-user
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch('/api/match-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token && {
          Authorization: `Bearer ${session.access_token}`,
        }),
      },
      credentials: 'include',
      body: JSON.stringify({ courseId }),
    });
    if (res.ok) {
      const j = await res.json();
      setRoomId(j.roomId);
      setStatus(j.status);
    } else {
      setStatus('idle');
      alert('Không thể ghép cặp');
    }
  };

  const onSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !roomId || !userId) return;
    const { error } = await supabase.from('chat_messages').insert({ room_id: roomId, sender_id: userId, content: text, type: 'text' });
    if (!error) setText('');
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId || !userId) return;
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${roomId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('chat-uploads').upload(path, file, { upsert: false });
    if (upErr) return alert(upErr.message);
    const { data: pub } = supabase.storage.from('chat-uploads').getPublicUrl(path);
    const mime = file.type;
    const type = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
    await supabase.from('chat_messages').insert({ room_id: roomId, sender_id: userId, type, file_url: pub.publicUrl, content: file.name });
    e.currentTarget.value = '';
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="rounded-lg bg-white p-4 shadow-level1">
        <h1 className="text-xl font-semibold">Học 1:1</h1>
        {!roomId ? (
          <button onClick={onMatch} className="mt-3 rounded-md bg-primary px-4 py-2 text-white">
            {status === 'matching' ? 'Đang tìm bạn học...' : 'Tìm bạn học'}
          </button>
        ) : (
          <p className="mt-2 text-sm opacity-80">Phòng: {roomId} ({status})</p>
        )}
      </div>

      {roomId && (
        <div className="mt-4 rounded-lg bg-white p-4 shadow-level1">
          <div className="max-h-[50vh] overflow-y-auto">
            {messages.map((m) => (
              <div key={m.id} className={`my-1 flex ${m.sender_id === userId ? 'justify-end' : 'justify-start'}`}>
                {m.type === 'text' && (
                  <div className={`rounded-md px-3 py-1.5 text-sm ${m.sender_id === userId ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                    {m.content}
                  </div>
                )}
                {m.type === 'image' && (
                  <img src={m.file_url} alt={m.content || ''} className="max-w-[60%] rounded-md" />
                )}
                {m.type === 'video' && (
                  <video src={m.file_url} controls className="max-w-[60%] rounded-md" />
                )}
                {m.type === 'audio' && (
                  <audio src={m.file_url} controls className="max-w-[60%]" />
                )}
                {m.type === 'file' && (
                  <a href={m.file_url} target="_blank" className="rounded-md bg-gray-100 px-3 py-1.5 text-sm underline">{m.content || 'Tệp'}</a>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={onSend} className="mt-3 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nhập tin nhắn..." className="flex-1 rounded-md border border-gray-200 px-3 py-2" />
            <button className="rounded-md bg-primary px-4 py-2 text-white">Gửi</button>
          </form>
          <div className="mt-2">
            <input type="file" onChange={onUpload} />
          </div>
        </div>
      )}
    </main>
  );
}

