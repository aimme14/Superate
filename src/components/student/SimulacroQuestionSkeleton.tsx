import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SimulacroQuestionSkeletonProps {
  theme?: "light" | "dark";
}

/**
 * Skeleton que imita la tarjeta de pregunta del simulacro.
 * Se muestra mientras cargan los ejercicios.
 */
export function SimulacroQuestionSkeleton({ theme = "light" }: SimulacroQuestionSkeletonProps) {
  const themeSafe = theme ?? "light";

  return (
    <Card
      className={cn(
        themeSafe === "dark" ? "bg-zinc-800 border-zinc-700" : "bg-white border-gray-200"
      )}
    >
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Skeleton
              className={cn(
                "h-9 w-20 rounded-lg",
                themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
              )}
            />
            <Skeleton
              className={cn(
                "h-5 w-28",
                themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
              )}
            />
          </div>
          <div className="flex gap-2">
            <Skeleton
              className={cn(
                "h-9 w-24 rounded-md",
                themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
              )}
            />
            <Skeleton
              className={cn(
                "h-9 w-20 rounded-md",
                themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton
            className={cn(
              "h-6 w-24 rounded-full",
              themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
            )}
          />
          <div className="space-y-2">
            <Skeleton
              className={cn(
                "h-4 w-full",
                themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
              )}
            />
            <Skeleton
              className={cn(
                "h-4 w-[95%]",
                themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
              )}
            />
            <Skeleton
              className={cn(
                "h-4 w-[85%]",
                themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
              )}
            />
          </div>
          <div className="space-y-2 pt-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className={cn(
                  "h-14 w-full rounded-lg",
                  themeSafe === "dark" ? "bg-zinc-700" : "bg-gray-200"
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
