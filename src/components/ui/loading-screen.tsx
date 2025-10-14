import { useLoadingScreen } from "@/hooks/ui/useLoading"
// import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export const LoadingScreen = () => {
  const { isLoading, text } = useLoadingScreen()

  // Versión simplificada sin framer-motion para diagnosticar
  return (
    <>
      {isLoading && (
        <div
          className={cn(
            "fixed inset-0 flex items-center justify-center",
            "bg-background/80 backdrop-blur-[2px]",
            "z-[9999]"
          )}
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              {text}
            </p>
          </div>
        </div>
      )}
    </>
  )
} 