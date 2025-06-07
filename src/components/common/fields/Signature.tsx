import SignatureDialog from "#/pages/documents/schedule/SignatureDialog"
import { ThemeContextProps } from '@/interfaces/context.interface'
import { HeaderSpanProps } from '@/interfaces/props.interface'
import { useFormContext, Controller } from 'react-hook-form'
import { Download, Trash2, Pen, Edit3 } from 'lucide-react'
import HeaderCustom from "#/common/elements/HeaderCustom"
import { useIsMobile } from '@/hooks/ui/use-mobile'
import React, { useState, useEffect } from 'react'
import { FormItem, FormMessage } from '#/ui/form'
import { Button } from '#/ui/button'

// @ts-ignore
import SignatureCanvas from "react-signature-canvas"
import { cn } from '@/lib/utils'

interface SignatureFieldProps extends HeaderSpanProps, ThemeContextProps {
  showDownload?: boolean
  placeholder?: string
  readOnly?: boolean
  hidden?: boolean
  height?: number
  label: string
  name: string
}

/**
 * Campo de firma digital integrado con react-hook-form
 * Permite capturar, guardar y limpiar firmas
 * Incluye un diálogo para firmar en pantalla completa
 */
const SignatureField = React.forwardRef<HTMLDivElement, SignatureFieldProps>(({
  showDownload = true,
  iconSpan = 'none',
  readOnly = false,
  theme = 'light',
  hidden = false,
  label,
  name,
  span,
}, ref) => {
  const [preview, setPreview] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const { control, setValue } = useFormContext()
  const isMobile = useIsMobile()

  /** Actualizar el valor del formulario cuando cambia la vista previa */
  useEffect(() => {
    if (preview) setValue(name, preview, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
  }, [preview, name, setValue])

  /** Descarga la firma guardada */
  const descargar = (fieldValue: string) => {
    if (!preview && !fieldValue) return alert("No hay firma para descargar")
    const link = document.createElement('a')
    link.download = `firma-${new Date().toISOString().slice(0, 10)}.png`
    link.href = preview || fieldValue
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  /** Manejador para cuando se confirma la firma en el diálogo */
  const handleSignatureConfirm = (signatureData: string | null) => {
    if (signatureData) {
      setPreview(signatureData)
      setValue(name, signatureData, { shouldValidate: true, shouldDirty: true, shouldTouch: true })
    }
    setDialogOpen(false)
  }

  return (
    <FormItem hidden={hidden}>
      {/* Header label */}
      <HeaderCustom
        to="input"
        span={span}
        theme={theme}
        title={label}
        iconSpan={iconSpan}
        htmlFor={`${name}-signature`}
      />

      {/* Diálogo de firma en pantalla completa */}
      <SignatureDialog
        open={dialogOpen}
        theme={theme}
        onOpenChange={setDialogOpen}
        onConfirm={handleSignatureConfirm}
        description="Utilice el panel a continuación para crear su firma"
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        title="Firma Digital"
      />

      {/* Signature field con react-hook-form */}
      <Controller
        name={name}
        control={control}
        render={({ field, fieldState: { error } }) => (
          <>
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="w-full"
            >
              <div className={cn(
                "w-full border rounded-lg overflow-hidden mb-2 relative",
                theme === 'dark'
                  ? "border-zinc-600 bg-zinc-800"
                  : "border-gray-300 bg-white",
                error && "border-red-500",
                readOnly && "opacity-70"
              )}>
                {/* Vista previa de la firma guardada (modo solo lectura) */}
                {readOnly && field.value && (
                  <div className="flex items-center justify-center py-2">
                    <img
                      src={field.value}
                      alt="Firma guardada"
                      className="max-h-[200px]"
                    />
                  </div>
                )}

                {/* Vista previa de la firma o placeholder */}
                {!readOnly && (
                  <div className="h-[150px] flex items-center justify-center">
                    {(preview || field.value) ? (
                      <div className="relative w-full h-full flex items-center justify-center bg-white">
                        <img
                          alt="Firma guardada"
                          src={preview || field.value}
                          className="max-h-[140px] object-contain"
                        />
                        <Button
                          size="sm"
                          type="button"
                          variant="ghost"
                          className="absolute top-2 right-2 h-8 w-8 p-0"
                          onClick={() => setDialogOpen(true)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "px-4 py-2 h-auto",
                          theme === 'dark'
                            ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-600"
                            : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-300"
                        )}
                        onClick={() => setDialogOpen(true)}
                      >
                        {!isMobile && <Pen className="h-4 w-4 mr-2" />}
                        {!isMobile ? 'Abrir panel para firmar' : 'Firmar'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              {!readOnly && (preview || field.value) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <Button
                    size="sm"
                    type="button"
                    className="flex-1"
                    variant="destructive"
                    onClick={() => {
                      setPreview(null)
                      setValue(name, null, {
                        shouldValidate: true,
                        shouldDirty: true,
                        shouldTouch: true
                      })
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Limpiar
                  </Button>

                  {showDownload && (
                    <Button
                      type="button"
                      onClick={() => descargar(field.value)}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "flex-1",
                        theme === 'dark'
                          ? "border-blue-700 text-blue-400 hover:bg-blue-900/20"
                          : "border-blue-300 text-blue-600 hover:bg-blue-50"
                      )}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Descargar
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Mensaje de error */}
            {error && (
              <FormMessage className={cn(theme === 'dark' ? "text-red-400" : "text-red-600")}>
                {error.message}
              </FormMessage>
            )}
          </>
        )}
      />
    </FormItem>
  )
})

SignatureField.displayName = 'SignatureField'

export default SignatureField