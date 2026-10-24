import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6" aria-busy="true" aria-label="جاري التحميل">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
