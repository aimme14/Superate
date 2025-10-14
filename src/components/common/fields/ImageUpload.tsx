import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

interface ImageUploadProps {
  value?: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  theme: 'light' | 'dark'
  className?: string
  accept?: string
  maxSize?: number // en MB
}

export default function ImageUpload({
  value,
  onChange,
  label,
  placeholder = "Seleccionar imagen...",
  theme,
  className,
  accept = "image/*",
  maxSize = 5
}: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (file: File) => {
    // Validar tamaño del archivo
    if (file.size > maxSize * 1024 * 1024) {
      alert(`El archivo es demasiado grande. Máximo ${maxSize}MB`)
      return
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten archivos de imagen')
      return
    }

    setIsUploading(true)
    
    try {
      // Convertir a base64 para simular subida
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        onChange(result)
        setIsUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error al procesar la imagen:', error)
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemoveImage = () => {
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className={cn(theme === 'dark' ? 'text-white' : 'text-gray-900')}>
          {label}
        </Label>
      )}
      
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 transition-colors",
          isDragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : theme === 'dark'
            ? "border-zinc-600 hover:border-zinc-500"
            : "border-gray-300 hover:border-gray-400",
          value && "border-solid"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {value ? (
          <div className="space-y-4">
            <div className="relative inline-block">
              <img
                src={value}
                alt="Logo de la institución"
                className="w-32 h-32 object-cover rounded-lg border"
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                onClick={handleRemoveImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
              Logo cargado correctamente
            </p>
          </div>
        ) : (
          <div className="text-center">
            {isUploading ? (
              <div className="space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                <p className={cn("text-sm", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>
                  Cargando imagen...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-800">
                  <ImageIcon className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <p className={cn("text-sm font-medium", theme === 'dark' ? 'text-white' : 'text-gray-900')}>
                    {placeholder}
                  </p>
                  <p className={cn("text-xs", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    PNG, JPG, GIF hasta {maxSize}MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClick}
                  className="mx-auto"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Seleccionar archivo
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
