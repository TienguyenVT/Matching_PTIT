import { requireAuth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ROUTES } from '@/lib/routes';

async function getCourse(courseId: string) {
  console.log('[LearnPage] Starting getCourse, courseId:', courseId);
  const supabase = supabaseServer();
  
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id,title,description,cover_url,level')
    .eq('id', courseId)
    .single();

  if (courseError) {
    console.error('[LearnPage] Course fetch error:', courseError);
  } else {
    console.log('[LearnPage] Course found:', course?.title || 'null');
  }

  const { data: contents, error: contentsError } = await supabase
    .from('course_contents')
    .select('id,title,kind,storage_path,order_index')
    .eq('course_id', courseId)
    .order('order_index');

  if (contentsError) {
    console.error('[LearnPage] Contents fetch error:', contentsError);
  } else {
    console.log('[LearnPage] Contents found:', contents?.length || 0, 'items');
  }

  return { course, contents: contents ?? [] };
}

export default async function LearnPage({ params }: { params: { courseId: string } }) {
  console.log('[LearnPage] Page rendering started, courseId:', params.courseId);
  
  const user = await requireAuth(ROUTES.LOGIN);
  console.log('[LearnPage] User authenticated:', user.id);
  
  const { courseId } = params;
  const { course, contents } = await getCourse(courseId);
  
  if (!course) {
    console.error('[LearnPage] Course not found:', courseId);
    notFound();
  }

  // Check if user is enrolled
  console.log('[LearnPage] Checking enrollment...');
  const supabase = supabaseServer();
  const { data: enrolled, error: enrolledError } = await supabase
    .from('user_courses')
    .select('*')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle();

  if (enrolledError) {
    console.error('[LearnPage] Error checking enrollment:', enrolledError);
  } else {
    console.log('[LearnPage] Enrollment status:', !!enrolled);
  }

  if (!enrolled) {
    console.error('[LearnPage] User not enrolled in course:', courseId);
    notFound();
  }

  console.log('[LearnPage] Page rendering complete');

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="rounded-lg bg-white p-4 shadow-level1">
        <h1 className="text-xl font-semibold">{course.title}</h1>
        <p className="mt-1 text-sm opacity-70">{course.description}</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <aside className="rounded-lg bg-white p-4 shadow-level1 md:col-span-1">
          <h2 className="text-sm font-medium uppercase tracking-wide">Nội dung</h2>
          <ol className="mt-3 space-y-2">
            {contents.map((c: any) => (
              <li key={c.id} className="rounded-md border border-gray-200 p-2 text-sm">
                <span className="mr-2 rounded bg-gray-100 px-2 py-0.5 text-xs uppercase">{c.kind}</span>
                {c.title}
              </li>
            ))}
          </ol>
        </aside>
        <section className="rounded-lg bg-white p-4 shadow-level1 md:col-span-2">
          {contents.length === 0 ? (
            <p className="opacity-70">Chưa có nội dung.</p>
          ) : (
            <div className="space-y-4">
              {contents[0].kind === 'video' && (
                <video src={contents[0].storage_path || ''} controls className="w-full rounded-md bg-black" />
              )}
              {contents[0].kind === 'doc' && (
                <a href={contents[0].storage_path || '#'} target="_blank" className="text-primary underline">Mở tài liệu</a>
              )}
              {contents[0].kind === 'quiz' && (
                <p className="opacity-80">Bài kiểm tra sẽ sớm khả dụng.</p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

