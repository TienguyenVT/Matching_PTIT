type Props = {
  title: string;
  description?: string;
  coverUrl?: string;
  level?: string;
  action?: React.ReactNode;
};

export function CourseCard({ title, description, coverUrl, level, action }: Props) {
  return (
    <div className="rounded-lg border shadow-sm overflow-hidden bg-white">
      {coverUrl ? (
        <img src={coverUrl} alt={title} className="h-36 w-full object-cover" />
      ) : (
        <div className="h-36 w-full bg-gray-100" />
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          {level && <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">{level}</span>}
        </div>
        {description && <p className="text-sm text-gray-600 line-clamp-2">{description}</p>}
        {action}
      </div>
    </div>
  );
}


