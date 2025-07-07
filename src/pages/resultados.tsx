import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HousePlug, ContactRound, NotepadText, BarChart2, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseApp } from "@/services/firebase/db.service";

const db = getFirestore(firebaseApp);


export default function EvaluationsTab() {

type Evaluation = {
  id: string;
  examName?: string;
  name?: string;
  date?: string | number | Date;
  score?: number;
};

const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchEvaluations = async () => {
    setLoading(true);
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setEvaluations([]);
      setLoading(false);
      return;
    }

    // Ajusta el nombre de la colección si es diferente
    const q = query(
      collection(db, "examResults"),
      where("userId", "==", user.uid)
    );
    const querySnapshot = await getDocs(q);

    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    setEvaluations(data);
    setLoading(false);
  };

  fetchEvaluations();
}, []);

return (
  <div>
    {/* Sección 1: Encabezado y Navegación */}
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <img src="/assets/agustina.png" width="80" height="80" alt="ICFES Logo" className="mr-2" />
          <span className="text-red-600 font-bold text-2xl">I.E. Colegio Agustina Ferro</span>
        </div>
        <nav className="hidden md:flex items-center space-x-8">
          <NavItem href="/informacionPage" icon={<ContactRound />} text="Información del estudiante" />
          <NavItem href="/resultados" icon={<NotepadText className="w-5 h-5" />} text="Resultados" active />
          <NavItem href="" icon={<HousePlug className="w-5 h-5" />} text="Mi progreso" />
          <NavItem href="/promedio" icon={<BarChart2 className="w-5 h-5" />} text="Plan de estudio actual" />
          <NavItem href="/dashboard#evaluacion" icon={<Apple className="w-5 h-5" />} text="Presentar prueba" />
        </nav>
      </div>
    </header>
    <Card>
      <CardHeader>
        <CardTitle>Mis Evaluaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <p>Cargando resultados...</p>
          ) : evaluations.length === 0 ? (
            <p>No has presentado ningún examen aún.</p>
          ) : (
            evaluations.map((evaluation) => (
              <div key={evaluation.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold">{evaluation.examName || evaluation.name}</h3>
                  <p className="text-sm text-gray-600">
                    Fecha: {evaluation.date ? new Date(evaluation.date).toLocaleDateString() : "Sin fecha"}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600">{evaluation.score}%</div>
                  <Button variant="outline" size="sm">Ver Detalles</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);
}

// Componentes auxiliares
interface NavItemProps {
  icon: React.ReactNode;
  active?: boolean;
  href: string;
  text: string;
}

function NavItem({ href, icon, text, active = false }: NavItemProps) {
  return (
    <Link
      to={href}
      className={`flex items-center ${active ? "text-red-600 font-medium" : "text-gray-600 hover:text-gray-900"}`}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>
    </Link>
  );
}
