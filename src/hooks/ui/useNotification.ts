import { useToast } from "@/hooks/ui/use-toast"
import { useCallback, useMemo } from "react"

interface NotificationProps {
  type?: "success" | "warning" | "error" | "info" | "default"
  message: string
  title?: string
}

export const useNotification = () => {
  const { toast } = useToast()

  const notify = useCallback(({ title, message, type = "info" }: NotificationProps) => {
    const variants = {
      error: "destructive",
      success: "success",
      warning: "warning",
      default: "default",
      info: "info"
    } as const

    toast({
      title: title,
      description: message,
      variant: variants[type],
      action: undefined,
      duration: 5000,
    })
  }, [toast])

  const notifySuccess = useCallback(
    (props: Omit<NotificationProps, "type">) => notify({ ...props, type: "success" }),
    [notify]
  )

  const notifyWarning = useCallback(
    (props: Omit<NotificationProps, "type">) => notify({ ...props, type: "warning" }),
    [notify]
  )

  const notifyError = useCallback(
    (props: Omit<NotificationProps, "type">) => notify({ ...props, type: "error" }),
    [notify]
  )

  const notifyInfo = useCallback(
    (props: Omit<NotificationProps, "type">) => notify({ ...props, type: "default" }),
    [notify]
  )

  return useMemo(() => ({
    notifySuccess,
    notifyWarning,
    notifyError,
    notifyInfo,
  }), [notifySuccess, notifyWarning, notifyError, notifyInfo])
}