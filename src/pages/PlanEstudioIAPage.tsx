import PromedioPage from "@/pages/promedio";

/**
 * Página dedicada al Plan de Estudio IA.
 * Reutiliza la lógica de promedio en modo exclusivo de plan de estudio.
 * Accesible desde la sección "Ruta de preparación" en la navegación.
 */
export default function PlanEstudioIAPage() {
  return <PromedioPage planOnly />;
}
