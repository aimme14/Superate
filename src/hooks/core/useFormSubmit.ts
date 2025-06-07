import { FieldValues, UseFormReturn } from 'react-hook-form'
import { useState } from 'react'

interface FormSubmitProps<T> {
  onSubmit: (data: T) => Promise<void>
  onSuccess?: () => void
}

export const useFormSubmit = <T extends FieldValues>({ onSubmit, onSuccess }: FormSubmitProps<T>, methods: UseFormReturn<T>) => {
  const [open, setOpen] = useState(false)

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    methods.trigger().then(isValid => isValid && setOpen(true))
  }

  const onConfirm = async () => {
    await onSubmit(methods.getValues())
    setOpen(false)
    onSuccess?.()
  }

  return { open, setOpen, handleSubmit, onConfirm }
}