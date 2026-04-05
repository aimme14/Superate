import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import InstitutionWizard from './InstitutionWizard'

interface InstitutionManagementProps {
  theme: 'light' | 'dark'
}

export default function InstitutionManagement({ theme }: InstitutionManagementProps) {
  const [isWizardOpen, setIsWizardOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={cn('text-2xl font-bold', theme === 'dark' ? 'text-white' : 'text-gray-900')}>
            Gestión de Instituciones
          </h2>
          <p className={cn('text-sm', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
            Alta de instituciones: solo creación. No se listan ni editan desde aquí.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="bg-black text-white hover:bg-gray-800 shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Crear Institución
        </Button>
      </div>

      <InstitutionWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} theme={theme} />
    </div>
  )
}
