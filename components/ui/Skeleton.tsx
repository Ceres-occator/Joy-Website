'use client';

export function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`neu-skeleton ${className}`} aria-hidden="true" />;
}

export function PaymentPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 grid gap-8 md:grid-cols-12" aria-busy="true">
      <div className="md:col-span-5 space-y-6">
        <div className="neu-card p-6 space-y-4">
          <SkeletonBox className="h-4 w-32" />
          <SkeletonBox className="h-7 w-48" />
          <div className="space-y-3 pt-3">
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-4 w-5/6" />
            <SkeletonBox className="h-4 w-4/6" />
          </div>
          <div className="neu-inset p-4 space-y-2">
            <SkeletonBox className="h-3 w-28" />
            <SkeletonBox className="h-8 w-40" />
          </div>
        </div>
      </div>

      <div className="md:col-span-7">
        <div className="neu-card p-6 sm:p-8 space-y-6">
          <SkeletonBox className="h-6 w-52" />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonBox className="h-12 w-full" />
            <SkeletonBox className="h-12 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SkeletonBox className="h-20 w-full" />
            <SkeletonBox className="h-20 w-full" />
          </div>
          <SkeletonBox className="h-48 w-full" />
          <div className="grid sm:grid-cols-2 gap-4">
            <SkeletonBox className="h-14 w-full" />
            <SkeletonBox className="h-14 w-full" />
          </div>
          <SkeletonBox className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBox className="h-3 w-24" />
          <SkeletonBox className="h-8 w-56" />
        </div>
        <div className="flex gap-3">
          <SkeletonBox className="h-10 w-44" />
          <SkeletonBox className="h-10 w-32" />
        </div>
      </div>

      <div className="neu-card p-4 space-y-3">
        <div className="grid grid-cols-6 gap-4 pb-3 border-b border-slate-300/40">
          {Array.from({ length: 6 }).map((_, idx) => (
            <SkeletonBox key={idx} className="h-4 w-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-6 gap-4 py-3 items-center">
            <div className="space-y-1.5">
              <SkeletonBox className="h-4 w-28" />
              <SkeletonBox className="h-3 w-20" />
            </div>
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-5 w-20" />
            <SkeletonBox className="h-6 w-24 rounded-full" />
            <div className="flex justify-end gap-2">
              <SkeletonBox className="h-8 w-16" />
              <SkeletonBox className="h-8 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBox className="h-3 w-28" />
          <SkeletonBox className="h-8 w-64" />
        </div>
        <div className="flex gap-3">
          <SkeletonBox className="h-10 w-36" />
          <SkeletonBox className="h-10 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="neu-card-sm p-5 space-y-3">
            <SkeletonBox className="h-3 w-24" />
            <SkeletonBox className="h-8 w-32" />
            <SkeletonBox className="h-2.5 w-28" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 neu-card p-5 space-y-4">
          <SkeletonBox className="h-5 w-44" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 28 }).map((_, idx) => (
              <SkeletonBox key={idx} className="h-10 w-full" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-7 neu-card p-5 space-y-4">
          <SkeletonBox className="h-5 w-48" />
          {Array.from({ length: 4 }).map((_, idx) => (
            <SkeletonBox key={idx} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-2 col-span-7 py-2" aria-busy="true">
      {Array.from({ length: 35 }).map((_, idx) => (
        <div key={idx} className="neu-inset-sm p-2.5 min-h-[82px] flex flex-col justify-between">
          <SkeletonBox className="h-3.5 w-6" />
          <div className="space-y-1.5 w-full">
            <SkeletonBox className="h-4 w-full" />
            <SkeletonBox className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MapSkeleton({ heightClass = 'h-72' }: { heightClass?: string }) {
  return (
    <div className={`neu-inset p-3 ${heightClass} flex flex-col justify-between`} aria-busy="true">
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-4 w-36" />
        <SkeletonBox className="h-6 w-24" />
      </div>
      <SkeletonBox className="h-full w-full my-2" />
      <SkeletonBox className="h-3 w-48" />
    </div>
  );
}

