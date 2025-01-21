import { useAuthContext } from '../../context/AuthContext'
import { registerSchema } from '../../schemas/auth.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

const defaultValues = {
  typeDocument: '',
  document: '',
  name: '',
  lastName: '',
  email: ''
}

export const useRegisterForm = () => {
  const { signup } = useAuthContext()

  const methods = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onSubmit',
    defaultValues
  })

  const onSubmit = methods.handleSubmit(async (data) => {
    await signup(data)
  })
  return { methods, onSubmit }
}