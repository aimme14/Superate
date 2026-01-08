import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useThemeContext } from "@/context/ThemeContext"

export interface ColorPalette {
  id: string
  name: string
  colors: {
    header: string
    welcome: string
    primary: string
    secondary: string
    accent: string
  }
}

export const SERIOUS_PALETTES: ColorPalette[] = [
  {
    id: 'navy-blue',
    name: 'Azul Marino',
    colors: {
      header: '#1e3a8a',
      welcome: '#1e40af',
      primary: '#2563eb',
      secondary: '#3b82f6',
      accent: '#60a5fa'
    }
  },
  {
    id: 'charcoal',
    name: 'Carbón',
    colors: {
      header: '#1f2937',
      welcome: '#374151',
      primary: '#4b5563',
      secondary: '#6b7280',
      accent: '#9ca3af'
    }
  },
  {
    id: 'slate',
    name: 'Pizarra',
    colors: {
      header: '#334155',
      welcome: '#475569',
      primary: '#64748b',
      secondary: '#94a3b8',
      accent: '#cbd5e1'
    }
  },
  {
    id: 'navy-slate',
    name: 'Azul Pizarra',
    colors: {
      header: '#1e293b',
      welcome: '#334155',
      primary: '#475569',
      secondary: '#64748b',
      accent: '#94a3b8'
    }
  },
  {
    id: 'deep-blue',
    name: 'Azul Profundo',
    colors: {
      header: '#1e40af',
      welcome: '#2563eb',
      primary: '#3b82f6',
      secondary: '#60a5fa',
      accent: '#93c5fd'
    }
  },
  {
    id: 'steel',
    name: 'Acero',
    colors: {
      header: '#374151',
      welcome: '#4b5563',
      primary: '#6b7280',
      secondary: '#9ca3af',
      accent: '#d1d5db'
    }
  }
]

interface ColorPaletteSelectorProps {
  selectedPalette?: string
  onPaletteChange?: (palette: ColorPalette) => void
}

export function ColorPaletteSelector({ selectedPalette, onPaletteChange }: ColorPaletteSelectorProps) {
  const { theme } = useThemeContext()

  const handlePaletteSelect = (palette: ColorPalette) => {
    if (onPaletteChange) {
      onPaletteChange(palette)
    }
    // Guardar en localStorage
    localStorage.setItem('dashboard-color-palette', palette.id)
    // Aplicar colores como variables CSS
    document.documentElement.style.setProperty('--dashboard-header', palette.colors.header)
    document.documentElement.style.setProperty('--dashboard-welcome', palette.colors.welcome)
    document.documentElement.style.setProperty('--dashboard-primary', palette.colors.primary)
    document.documentElement.style.setProperty('--dashboard-secondary', palette.colors.secondary)
    document.documentElement.style.setProperty('--dashboard-accent', palette.colors.accent)
  }

  return (
    <div className="p-2">
      <div className="grid grid-cols-3 gap-2">
        {SERIOUS_PALETTES.map((palette) => (
          <button
            key={palette.id}
            onClick={() => handlePaletteSelect(palette)}
            className={cn(
              "relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105",
              selectedPalette === palette.id
                ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
              theme === 'dark' ? 'bg-zinc-800' : 'bg-white'
            )}
          >
            {selectedPalette === palette.id && (
              <Check className="absolute top-1 right-1 h-4 w-4 text-blue-600 dark:text-blue-400" />
            )}
            <div className="flex gap-1">
              <div 
                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: palette.colors.header }}
              />
              <div 
                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: palette.colors.welcome }}
              />
              <div 
                className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: palette.colors.primary }}
              />
            </div>
            <span className={cn(
              "text-xs font-medium text-center",
              theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
            )}>
              {palette.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

