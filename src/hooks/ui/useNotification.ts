import { useToast } from "@/hooks/ui/use-toast"
import { useCallback } from "react"

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

  return {
    notifySuccess: (props: Omit<NotificationProps, "type">) =>
      notify({ ...props, type: "success" }),
    notifyWarning: (props: Omit<NotificationProps, "type">) =>
      notify({ ...props, type: "warning" }),
    notifyError: (props: Omit<NotificationProps, "type">) =>
      notify({ ...props, type: "error" }),
    notifyInfo: (props: Omit<NotificationProps, "type">) =>
      notify({ ...props, type: "default" })
  }
}