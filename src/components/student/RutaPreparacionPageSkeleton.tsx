import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

interface RutaPreparacionPageSkeletonProps {
  theme?: "light" | "dark";
  /** "ruta" | "simulacros-setup" */
  variant?: "ruta" | "simulacros-setup";
}

/**
 * Skeleton para páginas de Ruta de preparación (Ruta Académica, Simulacros IA, Simulacros ICFES).
 */
export function RutaPreparacionPageSkeleton({
  theme = "light",
  variant = "ruta",
}: RutaPreparacionPageSkeletonProps) {
  const isDark = theme === "dark";
  const cardClass = cn(
    "rounded-lg border",
    isDark ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
  );
  const skeletonClass = isDark ? "bg-zinc-700" : "bg-gray-200";

  if (variant === "simulacros-setup") {
    return (
      <div className="flex flex-col items-center -mt-1 pb-12">
        <Card className={cn("max-w-lg w-full mx-auto", cardClass)}>
          <CardContent className="pt-6 space-y-5">
            <div className="flex flex-col items-center gap-4">
              <Skeleton className={cn("w-14 h-14 rounded-xl", skeletonClass)} />
              <div className="space-y-2 w-full max-w-md">
                <Skeleton className={cn("h-4 w-full", skeletonClass)} />
                <Skeleton className={cn("h-4 w-[90%]", skeletonClass)} />
                <Skeleton className={cn("h-4 w-[70%]", skeletonClass)} />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton className={cn("h-4 w-28", skeletonClass)} />
              <Skeleton className={cn("h-10 w-full rounded-md", skeletonClass)} />
            </div>
            <Skeleton className={cn("h-11 w-full rounded-md", skeletonClass)} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap gap-2 rounded-lg border p-2",
          isDark ? "border-zinc-600 bg-zinc-800" : "border-gray-200 bg-white"
        )}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className={cn("h-10 w-28 rounded-md", skeletonClass)} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className={cardClass}>
            <CardContent className="p-4">
              <Skeleton className={cn("h-5 w-3/4 mb-3", skeletonClass)} />
              <Skeleton className={cn("h-4 w-full mb-2", skeletonClass)} />
              <Skeleton className={cn("h-4 w-1/2", skeletonClass)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
