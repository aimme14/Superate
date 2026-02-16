/**
 * Tip para la sección "Tips para Romperla en el ICFES".
 * Alineado con la estructura del backend (TipsIA en Firestore).
 */
export interface TipICFES {
  id?: string;
  title: string;
  description: string;
  subject: string;
  topic: string;
  level: string;
  category: string;
  example?: string;
  recommendation?: string;
  tags: string[];
  createdBy: string;
  createdAt: number;
  active: boolean;
}
