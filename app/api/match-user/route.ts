import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseServiceRole } from '@/lib/supabase/server';
import { matchUserBody } from '@/lib/validators';

export async function POST(req: NextRequest) {
  try {
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const json = await req.json();
    const parse = matchUserBody.safeParse(json);
    if (!parse.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    const { courseId } = parse.data;

    // Check enrollment via RLS-protected table
    const { count: enrolled } = await supabase
      .from('user_courses')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);
    if (!enrolled) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 });

    const svc = supabaseServiceRole();

    // Find an open room with exactly 1 member (not current user)
    const { data: openRooms } = await svc
      .from('chat_rooms')
      .select('id, course_id, status, created_at, members:chat_members(user_id)')
      .eq('course_id', courseId)
      .eq('status', 'open')
      .order('created_at', { ascending: true });

    let roomId: string | null = null;
    if (openRooms) {
      for (const r of openRooms as any[]) {
        const members = r.members || [];
        if (members.length === 1 && members[0].user_id !== user.id) {
          roomId = r.id;
          break;
        }
      }
    }

    if (roomId) {
      // Join and mark matched
      const { error: joinErr } = await svc
        .from('chat_members')
        .insert({ room_id: roomId, user_id: user.id });
      if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 400 });
      await svc.from('chat_rooms').update({ status: 'matched' }).eq('id', roomId);
      return NextResponse.json({ roomId, status: 'matched' });
    }

    // Create new open room and add current user
    const { data: newRoom, error: roomErr } = await svc
      .from('chat_rooms')
      .insert({ course_id: courseId, status: 'open' })
      .select('id')
      .single();
    if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 400 });

    const { error: memErr } = await svc
      .from('chat_members')
      .insert({ room_id: newRoom!.id, user_id: user.id });
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

    return NextResponse.json({ roomId: newRoom!.id, status: 'open' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
