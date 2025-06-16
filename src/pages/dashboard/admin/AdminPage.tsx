import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/ui/tabs'
import { useThemeContext } from '@/context/ThemeContext'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const AdminDashboardPage = () => {
  const { theme } = useThemeContext()
  const [activeTab, setActiveTab] = useState('overview')
  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className={cn('text-3xl font-bold', theme === 'dark' ? 'text-white' : 'text-black')}>
        Panel de Administración
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}

export default AdminDashboardPage