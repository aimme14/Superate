import { useState, useEffect } from "react"

export interface UserDashboardData {// Estadísticas generales
  totalCompletedMaintenances: number
  totalAssignedEquipments: number
  pendingMaintenances: number

  // Datos para gráficos y análisis
  maintenancesByStatus: {
    inProgress: number
    completed: number
    cancelled: number
    pending: number
  }

  // Actividades recientes
  recentActivities: {
    description: string
    status: string
    title: string
    type: string
    date: string
    id: string
  }[]

  // Próximos mantenimientos
  upcomingMaintenances: {
    priority: 'low' | 'medium' | 'high'
    equipmentName: string
    clientName: string
    location: string
    date: string
    id: string
  }[]

  // Rendimiento
  performanceMetrics: {
    averageResolutionTime: string
    clientSatisfaction: number
    completionRate: number
  }

  // Notificaciones
  notifications: {
    type: 'info' | 'warning' | 'urgent'
    message: string
    read: boolean
    date: string
    id: string
  }[]
}

export function useUserDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<UserDashboardData>({
    totalAssignedEquipments: 0,
    totalCompletedMaintenances: 0,
    pendingMaintenances: 0,
    maintenancesByStatus: {
      pending: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0
    },
    recentActivities: [],
    upcomingMaintenances: [],
    performanceMetrics: {
      averageResolutionTime: '',
      completionRate: 0,
      clientSatisfaction: 0
    },
    notifications: []
  })

  useEffect(() => {// Simulación de carga de datos
    const fetchData = async () => {
      try {// Aquí iría la llamada a la API real
        await new Promise(resolve => setTimeout(resolve, 1000))
        setData({// Datos de ejemplo para desarrollo
          totalAssignedEquipments: 24,
          totalCompletedMaintenances: 18,
          pendingMaintenances: 6,
          maintenancesByStatus: {
            pending: 6,
            inProgress: 4,
            completed: 18,
            cancelled: 2
          },
          recentActivities: [
            {
              id: '1',
              type: 'maintenance',
              title: 'Mantenimiento completado',
              description: 'Equipo de rayos X en Hospital Central',
              date: '2025-04-11T14:30:00',
              status: 'completed'
            },
            {
              id: '2',
              type: 'inspection',
              title: 'Inspección realizada',
              description: 'Equipo de ultrasonido en Clínica Norte',
              date: '2025-04-10T10:15:00',
              status: 'completed'
            },
            {
              id: '3',
              type: 'repair',
              title: 'Reparación de emergencia',
              description: 'Monitor cardíaco en UCI Hospital Sur',
              date: '2025-04-09T16:45:00',
              status: 'completed'
            }
          ],
          upcomingMaintenances: [
            {
              id: '1',
              equipmentName: 'Resonador magnético',
              clientName: 'Hospital Central',
              date: '2025-04-15T09:00:00',
              priority: 'high',
              location: 'Área de Imagenología, Piso 2'
            },
            {
              id: '2',
              equipmentName: 'Ventilador mecánico',
              clientName: 'Clínica Norte',
              date: '2025-04-16T11:30:00',
              priority: 'medium',
              location: 'UCI, Piso 3'
            },
            {
              id: '3',
              equipmentName: 'Desfibrilador',
              clientName: 'Hospital Sur',
              date: '2025-04-18T14:00:00',
              priority: 'low',
              location: 'Emergencias, Planta baja'
            }
          ],
          performanceMetrics: {
            averageResolutionTime: '4h 30m',
            completionRate: 85,
            clientSatisfaction: 92
          },
          notifications: [
            {
              id: '1',
              message: 'Nuevo mantenimiento asignado: Resonador magnético en Hospital Central',
              type: 'info',
              date: '2025-04-11T08:15:00',
              read: false
            },
            {
              id: '2',
              message: 'Mantenimiento urgente requerido: Ventilador en UCI',
              type: 'urgent',
              date: '2025-04-11T07:30:00',
              read: false
            },
            {
              id: '3',
              message: 'Recordatorio: Inspección programada mañana a las 9:00 AM',
              type: 'warning',
              date: '2025-04-10T16:00:00',
              read: true
            }
          ]
        })
      } catch (error) {
        console.error('Error fetching engineer dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, loading }
}
