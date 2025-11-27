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

  // Load modules
  const { data: modules, error: modulesError } = await supabase
    .from('course_modules')
    .select('id,title,chapter_number,order_index')
    .eq('course_id', courseId)
    .order('order_index');

  if (modulesError) {
    console.error('[LearnPage] Modules fetch error:', modulesError);
  } else {
    console.log('[LearnPage] Modules found:', modules?.length || 0, 'modules');
  }

  // Load contents
  const { data: contents, error: contentsError } = await supabase
    .from('course_contents')
    .select('id,title,kind,storage_path,order_index,module_id')
    .eq('course_id', courseId)
    .order('order_index');

  if (contentsError) {
    console.error('[LearnPage] Contents fetch error:', contentsError);
  } else {
    console.log('[LearnPage] Contents found:', contents?.length || 0, 'items');
  }

  return {
    course,
    modules: modules ?? [],
    contents: contents ?? []
  };
}

export default async function LearnPage({ params }: { params: { courseId: string } }) {
  console.log('[LearnPage] Page rendering started, courseId:', params.courseId);

  const user = await requireAuth(ROUTES.LOGIN);
  console.log('[LearnPage] User authenticated:', user.id);

  const { courseId } = params;
  const { course, modules, contents } = await getCourse(courseId);

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
          <h2 className="text-sm font-medium uppercase tracking-wide">Chương trình học</h2>
          <div className="mt-3 space-y-2">
            {modules.length === 0 ? (
              <p className="text-sm text-gray-500">Chưa có học phần</p>
            ) : (
              modules.map((module: any) => {
                const moduleContents = contents.filter((c: any) => c.module_id === module.id);
                return (
                  <div key={module.id} className="border border-gray-200 rounded-md p-2">
                    <h3 className="text-sm font-medium text-gray-800 mb-2">{module.title}</h3>
                    {moduleContents.length > 0 ? (
                      <ol className="space-y-1 ml-2">
                        {moduleContents.map((content: any) => (
                          <li key={content.id} className="text-xs text-gray-600">
                            <span className="mr-1 rounded bg-gray-100 px-1 py-0.5 text-xs uppercase">{content.kind}</span>
                            {content.title}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-xs text-gray-400">Chưa có bài học</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
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

