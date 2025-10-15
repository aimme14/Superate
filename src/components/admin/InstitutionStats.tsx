import { useInstitutionStats } from '@/hooks/query/useInstitutionStats'
import { Users, GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InstitutionStatsProps {
  institutionId: string
  theme: 'light' | 'dark'
  className?: string
}

export default function InstitutionStats({ institutionId, theme, className }: InstitutionStatsProps) {
  const { studentCount, teacherCount, isLoading } = useInstitutionStats(institutionId)

  if (isLoading) {
    return (
      <div className={cn('flex items-center space-x-4', className)}>
        <div className="flex items-center space-x-1">
          <Users className="h-3 w-3 text-gray-400 animate-pulse" />
          <span className="text-sm text-gray-400 animate-pulse">...</span>
        </div>
        <div className="flex items-center space-x-1">
          <GraduationCap className="h-3 w-3 text-gray-400 animate-pulse" />
          <span className="text-sm text-gray-400 animate-pulse">...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center space-x-4', className)}>
      <div className="flex items-center space-x-1">
        <Users className="h-3 w-3 text-gray-400" />
        <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          {studentCount} estudiantes
        </span>
      </div>
      <div className="flex items-center space-x-1">
        <GraduationCap className="h-3 w-3 text-gray-400" />
        <span className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
          {teacherCount} docentes
        </span>
      </div>
    </div>
  )
}
