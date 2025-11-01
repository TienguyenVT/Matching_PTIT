import { CourseCard } from './CourseCard';
import { Button } from '@/components/ui/Button';

type Course = {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  level?: string;
};

export function CourseList({ items, onRegister }: { items: Course[]; onRegister?: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((c) => (
        <CourseCard
          key={c.id}
          title={c.title}
          description={c.description}
          coverUrl={c.cover_url}
          level={c.level}
          action={
            onRegister ? (
              <Button onClick={() => onRegister(c.id)}>Đăng ký</Button>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}


