import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageGalleryProps {
  images: string[]
  title?: string
  className?: string
  maxImages?: number
  showTitle?: boolean
}

export default function ImageGallery({ 
  images, 
  title = "Imágenes", 
  className,
  maxImages = 3,
  showTitle = true
}: ImageGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (!images || images.length === 0) {
    return null
  }

  const displayImages = images.slice(0, maxImages)
  const hasMore = images.length > maxImages

  const openGallery = (index: number) => {
    setSelectedIndex(index)
    setIsOpen(true)
  }

  const nextImage = () => {
    setSelectedIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setSelectedIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {showTitle && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title} ({images.length})
        </p>
      )}
      
      <div className={cn(
        "grid gap-2",
        maxImages === 1 ? "grid-cols-1" :
        maxImages === 2 ? "grid-cols-2" :
        maxImages === 3 ? "grid-cols-3" :
        "grid-cols-4"
      )}>
        {displayImages.map((url, index) => (
          <div 
            key={index} 
            className="relative group cursor-pointer"
            onClick={() => openGallery(index)}
          >
            <img 
              src={url} 
              alt={`${title} ${index + 1}`}
              className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center">
              <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {index === maxImages - 1 && hasMore && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  +{images.length - maxImages}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal de galería */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center justify-between">
              <span>{title} - {selectedIndex + 1} de {images.length}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative p-6">
            <img 
              src={images[selectedIndex]} 
              alt={`${title} ${selectedIndex + 1}`}
              className="w-full h-auto max-h-[60vh] object-contain mx-auto rounded-lg"
            />
            
            {/* Navegación */}
            {images.length > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute left-4 top-1/2 transform -translate-y-1/2"
                  onClick={prevImage}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                  onClick={nextImage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          {images.length > 1 && (
            <div className="p-6 pt-0">
              <div className="flex gap-2 overflow-x-auto">
                {images.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Miniatura ${index + 1}`}
                    className={cn(
                      "w-16 h-16 object-cover rounded cursor-pointer border-2 transition-all",
                      index === selectedIndex 
                        ? "border-blue-500" 
                        : "border-gray-200 hover:border-gray-400"
                    )}
                    onClick={() => setSelectedIndex(index)}
                  />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
