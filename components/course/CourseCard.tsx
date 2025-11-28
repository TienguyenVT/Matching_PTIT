type Props = {
  title: string;
  description?: string;
  coverUrl?: string;
  level?: string;
  action?: React.ReactNode;
};

export function CourseCard({ title, description, coverUrl, level, action }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {coverUrl ? (
        <img src={coverUrl} alt={title} className="h-36 w-full object-cover" />
      ) : (
        <div className="h-36 w-full bg-gray-100" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{title}</h3>
          {level && <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium">{level}</span>}
        </div>
        {description && <p className="text-sm text-gray-600 line-clamp-2">{description}</p>}
        {action}
      </div>
    </div>
  );
}


