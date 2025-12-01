import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "#/ui/radio-group";
import { Label } from "#/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "#/ui/card";
import { ZoomIn, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Componente de demostración del layout 2x2 para respuestas con imágenes
 * Muestra cómo se verán las opciones cuando todas tienen imágenes
 */
export const ImageOptionsDemo = () => {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Opciones de ejemplo con imágenes
  const options = [
    {
      id: "A",
      imageUrl: "https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Opción+A"
    },
    {
      id: "B",
      imageUrl: "https://via.placeholder.com/300x200/7C3AED/FFFFFF?text=Opción+B"
    },
    {
      id: "C",
      imageUrl: "https://via.placeholder.com/300x200/EC4899/FFFFFF?text=Opción+C"
    },
    {
      id: "D",
      imageUrl: "https://via.placeholder.com/300x200/F59E0B/FFFFFF?text=Opción+D"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Vista Previa: Layout 2x2 para Respuestas con Imágenes
            </CardTitle>
            <p className="text-center text-gray-600 mt-2">
              Cuando todas las opciones tienen imágenes (sin texto), se muestra en formato 2x2
            </p>
          </CardHeader>
          <CardContent>
            {/* Layout 2x2 - Como se verá en los cuestionarios */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Pregunta de Ejemplo:</h3>
              <p className="text-gray-700 mb-6">
                Selecciona la opción correcta basándote en las imágenes mostradas:
              </p>

              <RadioGroup
                value={selectedOption}
                onValueChange={setSelectedOption}
                className="mt-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  {options.map((option) => (
                    <div
                      key={option.id}
                      onClick={() => setSelectedOption(option.id)}
                      className={cn(
                        "relative rounded-lg p-2 transition-all duration-200 cursor-pointer border-2",
                        selectedOption === option.id
                          ? "border-purple-500 bg-purple-50 shadow-md"
                          : "border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50/50"
                      )}
                    >
                      <RadioGroupItem
                        value={option.id}
                        id={`demo-${option.id}`}
                        className="absolute top-1.5 left-1.5 z-10"
                      />
                      <div className="flex flex-col items-center justify-center pt-5">
                        <span className="font-bold text-sm mb-1.5 text-purple-600">
                          {option.id}.
                        </span>
                        <div
                          className="relative w-full flex justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            setZoomedImage(option.imageUrl);
                          }}
                        >
                          <img
                            src={option.imageUrl}
                            alt={`Opción ${option.id}`}
                            className="max-w-[180px] max-h-[120px] w-auto h-auto rounded-md cursor-zoom-in hover:opacity-90 transition-opacity object-contain shadow-sm"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 rounded-md">
                            <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              {selectedOption && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    ✓ Opción {selectedOption} seleccionada
                  </p>
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Características:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
                  <li>Layout 2x2: A y B arriba, C y D abajo</li>
                  <li>Haz clic en cualquier imagen para hacer zoom</li>
                  <li>Hover sobre la imagen muestra el icono de zoom</li>
                  <li>La opción seleccionada se resalta con borde morado</li>
                  <li>Optimiza el espacio en pantalla</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comparación con layout tradicional */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold">
              Comparación: Layout Tradicional (cuando hay texto)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {options.slice(0, 2).map((option) => (
                <div
                  key={option.id}
                  className="flex items-start space-x-3 border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <RadioGroupItem
                    value={option.id}
                    id={`traditional-${option.id}`}
                    className="mt-1"
                  />
                  <Label htmlFor={`traditional-${option.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-base text-purple-600">{option.id}.</span>
                      <div className="flex-1">
                        <span className="text-base leading-relaxed text-gray-700">
                          Texto de ejemplo para la opción {option.id}
                        </span>
                        <div className="mt-2 flex justify-center">
                          <img
                            src={option.imageUrl}
                            alt={`Opción ${option.id}`}
                            className="max-w-xs h-auto rounded-md cursor-zoom-in hover:opacity-90 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedImage(option.imageUrl);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-sm">
                <strong>Nota:</strong> Cuando las opciones tienen texto, se usa el layout vertical tradicional.
                El layout 2x2 solo se activa cuando todas las opciones tienen imágenes y no tienen texto.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de zoom */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[100] p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={zoomedImage}
              alt="Imagen ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

