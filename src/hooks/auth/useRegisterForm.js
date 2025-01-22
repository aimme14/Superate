import { useAuthContext } from '../../context/AuthContext'
import { registerSchema } from '../../schemas/auth.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Swal from 'sweetalert2'

const defaultValues = {
  typeDocument: '',
  document: '',
  name: '',
  lastName: '',
  email: ''
}

export const useRegisterForm = () => {
  const { signup } = useAuthContext()
  const navigate = useNavigate()

  const methods = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues
  })

  const onSubmit = methods.handleSubmit(async (data) => {
    await signup(data)
    Swal.fire({
      title: 'Usuario registrado',
      text: 'Usuario registrado correctamente',
      icon: 'success'
    })
    navigate('/dashboard')
  })
  return { methods, onSubmit }
}