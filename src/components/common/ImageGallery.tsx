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

  if (!images || images.length === 0) {
    return null
  }

  const displayImages = images.slice(0, maxImages)
  const hasMore = images.length > maxImages

  return (
    <div className={cn("space-y-2", className)}>
      {showTitle && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title} ({images.length})
        </p>
      )}
      
      <div className={cn(
        "grid gap-4",
        displayImages.length === 1 ? "grid-cols-1" :
        displayImages.length === 2 ? "grid-cols-2" :
        "grid-cols-1 md:grid-cols-2"
      )}>
        {displayImages.map((url, index) => (
          <div 
            key={index} 
            className="relative"
          >
            <img 
              src={url} 
              alt={`${title} ${index + 1}`}
              className="w-full h-auto max-h-[600px] object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
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
    </div>
  )
}
