import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface PageLoaderProps {
  className?: string;
}

export const PageLoader = ({ className }: PageLoaderProps) => {
  return (
    <div className={cn("flex flex-col items-center justify-center w-full min-h-[400px] gap-6", className)}>
      <Skeleton className="h-10 w-[60%] max-w-md rounded-lg" />
      <div className="w-full max-w-2xl space-y-4">
        <Skeleton className="h-6 w-full rounded-md" />
        <Skeleton className="h-6 w-full rounded-md" />
        <Skeleton className="h-6 w-3/4 rounded-md" />
      </div>
      <div className="w-full max-w-2xl space-y-4 mt-4">
        <Skeleton className="h-6 w-full rounded-md" />
        <Skeleton className="h-6 w-5/6 rounded-md" />
      </div>
    </div>
  );
};
