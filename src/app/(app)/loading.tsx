import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-64 rounded-3xl lg:col-span-5" />
        <div className="grid grid-cols-2 gap-4 lg:col-span-7">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-2xl" />)}
        </div>
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
