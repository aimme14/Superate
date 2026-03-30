/**
 * Estima el tamaño en bytes de los documentos de la colección top-level `Simulacros`
 * (solo campos del documento; no incluye subcolecciones Videos / ICFES).
 *
 * Ejecutar: npx tsx src/scripts/measureSimulacrosCollection.ts
 */

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocsFromServer,
  Timestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOYy9sRGzlVjNKJhpNdkwPT7vWxXfBzec",
  authDomain: "superate-e7b18.firebaseapp.com",
  projectId: "superate-e7b18",
  storageBucket: "superate-e7b18.firebasestorage.app",
  messagingSenderId: "428859712652",
  appId: "1:428859712652:web:19cf31835cc2e5d4e03f8d",
};

function serializeForMeasure(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serializeForMeasure);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeForMeasure(v);
    }
    return out;
  }
  return value;
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  let snap;
  try {
    snap = await getDocsFromServer(collection(db, "Simulacros"));
  } catch (e) {
    console.error(
      "\nNo se pudo leer Simulacros desde el servidor (¿reglas / sin sesión?).\n" +
        "Las reglas exigen `canAccessOrToken()`. Usa la consola de Firebase, credenciales de admin,\n" +
        "o ejecuta tras autenticar un cliente con permiso de lectura.\n"
    );
    throw e;
  }

  let totalPayloadBytes = 0;
  let maxDocBytes = 0;
  let maxDocId = "";

  snap.forEach((d) => {
    const payload = serializeForMeasure(d.data());
    const json = JSON.stringify(payload);
    const bytes = Buffer.byteLength(json, "utf8");
    totalPayloadBytes += bytes;
    if (bytes > maxDocBytes) {
      maxDocBytes = bytes;
      maxDocId = d.id;
    }
  });

  const ONE_MIB = 1024 * 1024;
  const totalWithIds =
    totalPayloadBytes +
    snap.size * 32; /* aprox. overhead id + estructura por doc al fusionar */

  console.log("Colección: Simulacros (solo documentos padre, sin subcolecciones)\n");
  console.log(`  Documentos: ${snap.size}`);
  console.log(
    `  Suma JSON serializado (campos): ~${totalPayloadBytes.toLocaleString()} bytes (~${(totalPayloadBytes / ONE_MIB).toFixed(3)} MiB)`
  );
  console.log(
    `  Documento más grande: ~${maxDocBytes.toLocaleString()} bytes (id: ${maxDocId || "—"})`
  );
  console.log(
    `  ¿Todo el payload cabría en 1 documento (límite Firestore 1 MiB)? ${
      totalWithIds <= ONE_MIB ? "SÍ (estimación bruta)" : "NO (estimación bruta)"
    }`
  );
  console.log(
    "\nNota: el límite de 1 MiB es por documento individual; la suma de la colección puede superar 1 MiB sin problema."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
