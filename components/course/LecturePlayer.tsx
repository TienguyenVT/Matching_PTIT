type Props = {
  kind: 'video' | 'doc' | 'quiz';
  url?: string;
  title: string;
};

export function LecturePlayer({ kind, url, title }: Props) {
  if (kind === 'video' && url) {
    return (
      <video controls className="w-full rounded-lg bg-black" src={url} />
    );
  }
  if (kind === 'doc' && url) {
    return (
      <iframe title={title} src={url} className="w-full h-[60vh] rounded-lg border" />
    );
  }
  return <div className="p-6 rounded-lg border">Nội dung sẽ sớm có.</div>;
}


