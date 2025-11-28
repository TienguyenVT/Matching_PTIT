import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseServiceRole } from '@/lib/supabase/server';
import { registerCourseBody } from '@/lib/validators';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    let user;
    let supabase = supabaseServer();
    
    // Ưu tiên: Nếu có Bearer token, verify token
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
      
      if (url && anon) {
        // Tạo client tạm để verify token
        const tempClient = createClient(url, anon);
        const { data: { user: tokenUser }, error: tokenError } = await tempClient.auth.getUser(token);
        if (!tokenError && tokenUser) {
          user = tokenUser;
        }
      }
    }
    
    // Fallback: Lấy user từ cookie
    if (!user) {
      const { data: { user: cookieUser }, error: cookieError } = await supabase.auth.getUser();
      if (!cookieError && cookieUser) {
        user = cookieUser;
      }
    }
    
    if (!user) {
      console.error('No user found. Auth header:', authHeader ? 'present' : 'missing');
      return NextResponse.json({ error: 'Unauthorized. Vui lòng đăng nhập lại.' }, { status: 401 });
    }
    
    // Nếu dùng Bearer token, cần dùng service role client cho queries
    // vì user_id sẽ được truyền trực tiếp

    let json;
    try {
      json = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    const parse = registerCourseBody.safeParse(json);
    if (!parse.success) {
      console.error('Validation error:', parse.error.errors);
      return NextResponse.json({ 
        error: 'Invalid body', 
        details: parse.error.errors 
      }, { status: 400 });
    }
    const { courseId } = parse.data;
    
    // Validate courseId is a valid UUID format
    if (!courseId || typeof courseId !== 'string') {
      return NextResponse.json({ error: 'courseId is required and must be a string' }, { status: 400 });
    }

    // Nếu dùng Bearer token, dùng service role client để bypass RLS
    // Vì Bearer token không set session trong server context
    const queryClient = authHeader?.startsWith('Bearer ') 
      ? supabaseServiceRole() 
      : supabase;

    // Đảm bảo profile tồn tại trước khi insert vào user_courses
    const { data: existingProfile } = await queryClient
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!existingProfile) {
      // Tạo profile nếu chưa có
      const { error: profileError } = await queryClient
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return NextResponse.json({ 
          error: 'Không thể tạo hồ sơ người dùng. Vui lòng thử lại sau.' 
        }, { status: 500 });
      }
    }

    // Check count <= 2 for current user
    const { count } = await queryClient
      .from('user_courses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if ((count ?? 0) >= 2) {
      return NextResponse.json({ error: 'Bạn chỉ được phép đăng ký tối đa 2 khóa học' }, { status: 400 });
    }

    const { error: insertErr } = await queryClient
      .from('user_courses')
      .insert({ user_id: user.id, course_id: courseId });

    if (insertErr) {
      console.error('Insert error:', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    // Best-effort notification for successful course registration
    try {
      // Lấy thêm tiêu đề khóa học để hiển thị đẹp hơn trong thông báo (optional)
      const { data: course, error: courseError } = await queryClient
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .maybeSingle();

      if (courseError) {
        console.warn('[register-course] Error fetching course for notification:', courseError);
      }

      const { error: notifError } = await queryClient
        .from('notifications')
        .insert({
          user_id: user.id,
          title: 'Đăng ký khóa học thành công',
          message: course?.title
            ? `Bạn đã đăng ký khóa học "${course.title}" thành công.`
            : 'Bạn đã đăng ký một khóa học mới thành công.',
          type: 'course_register',
          read: false,
          metadata: {
            course_id: courseId,
          },
        });

      if (notifError) {
        console.warn('[register-course] Error creating notification:', notifError);
      }
    } catch (notifErr) {
      console.warn('[register-course] Exception while creating notification:', notifErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
