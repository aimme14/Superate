import { useQuery } from '@tanstack/react-query'
import { dbService } from '@/services/firebase/db.service'

interface MonthlyRevenueData {
  month: string
  monthNumber: number
  year: number
  students: number
  revenue: number
}

/**
 * Hook para obtener ingresos mensuales basados en estudiantes registrados
 * Cada estudiante representa $120.000 de ingreso
 */
export const useMonthlyRevenue = (year?: number) => {
  return useQuery({
    queryKey: ['admin', 'monthly-revenue', year],
    queryFn: async () => {
      // Obtener todos los usuarios estudiantes
      const usersResult = await dbService.getAllUsers()
      if (!usersResult.success) {
        throw usersResult.error
      }

      const allUsers = usersResult.data as any[]
      
      // Filtrar solo estudiantes activos
      const students = allUsers.filter((user: any) => {
        if (user.role !== 'student' || user.isActive !== true) {
          return false
        }

        // Filtrar por año si se especifica
        if (year !== undefined) {
          if (!user.createdAt) return false
          
          let date: Date
          if (typeof user.createdAt === 'string') {
            date = new Date(user.createdAt)
          } else if (user.createdAt?.toDate) {
            date = user.createdAt.toDate()
          } else if (user.createdAt?.seconds) {
            date = new Date(user.createdAt.seconds * 1000)
          } else if (user.createdAt instanceof Date) {
            date = user.createdAt
          } else {
            return false
          }
          
          return date.getFullYear() === year
        }

        return true
      })

      // Agrupar por mes y año
      const monthlyData: Record<string, { students: number; month: number; year: number }> = {}

      students.forEach((student: any) => {
        if (!student.createdAt) return

        let date: Date
        if (typeof student.createdAt === 'string') {
          date = new Date(student.createdAt)
        } else if (student.createdAt?.toDate) {
          date = student.createdAt.toDate()
        } else if (student.createdAt?.seconds) {
          date = new Date(student.createdAt.seconds * 1000)
        } else if (student.createdAt instanceof Date) {
          date = student.createdAt
        } else {
          return
        }

        const month = date.getMonth() + 1 // 1-12
        const year = date.getFullYear()
        const key = `${year}-${month.toString().padStart(2, '0')}`

        if (!monthlyData[key]) {
          monthlyData[key] = { students: 0, month, year }
        }
        monthlyData[key].students++
      })

      // Convertir a array y ordenar por fecha
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

      const revenueData: MonthlyRevenueData[] = Object.entries(monthlyData)
        .map(([, data]) => ({
          month: `${months[data.month - 1]} ${data.year}`,
          monthNumber: data.month,
          year: data.year,
          students: data.students,
          revenue: data.students * 120000
        }))
        .sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          return a.monthNumber - b.monthNumber
        })

      return revenueData
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  })
}

