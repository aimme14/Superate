/**
 * Script de migración: WebLinks (ruta antigua) → WebLinks (ruta nueva)
 *
 * Copia los enlaces de la estructura antigua a la nueva:
 *   Antes: WebLinks/{Fase I|II|III}/{subject}/{topicId}/links/link01...link50
 *   Nueva:  WebLinks/{materia}/{topicId}/link1, link2...
 *
 * Caché global por materia y topic (sin fase).
 *
 * Uso:
 *   npm run build
 *   node lib/scripts/migrateWebLinks.js
 *
 * Requiere: serviceAccountKey.json en functions/ (o GOOGLE_APPLICATION_CREDENTIALS)
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const PHASES = ['Fase I', 'Fase II', 'Fase III'];
const MAX_LINKS = 50;

function initializeFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  let credential: admin.credential.Credential;
  let projectId = process.env.FIREBASE_PROJECT_ID || '';

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    let absPath = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
    if (!fs.existsSync(absPath) && !path.isAbsolute(credPath)) {
      absPath = path.resolve(__dirname, '../../', credPath);
    }
    if (fs.existsSync(absPath)) {
      const sa = JSON.parse(fs.readFileSync(absPath, 'utf8'));
      credential = admin.credential.cert(sa);
      projectId = projectId || sa.project_id || 'superate-ia';
      console.log(`✅ Usando ${path.basename(absPath)} (proyecto: ${projectId})`);
    } else {
      credential = admin.credential.applicationDefault();
      projectId = projectId || 'superate-ia';
      console.warn(`⚠️ No encontrado: ${absPath}. Usando credenciales por defecto.`);
    }
  } else {
    const defaultPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(defaultPath)) {
      const sa = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
      credential = admin.credential.cert(sa);
      projectId = projectId || sa.project_id || 'superate-6c730';
      console.log(`✅ Usando serviceAccountKey.json (proyecto: ${projectId})`);
    } else {
      credential = admin.credential.applicationDefault();
      projectId = projectId || 'superate-ia';
      console.log(`✅ Usando credenciales por defecto (proyecto: ${projectId})`);
    }
  }

  admin.initializeApp({ credential, projectId: projectId || 'superate-ia' });
  return admin.firestore();
}

const db = initializeFirebase();

interface LinkData {
  title: string;
  url: string;
  description: string;
  order?: number;
}

async function getLinksFromOldStructure(
  phase: string,
  subject: string,
  topicId: string
): Promise<LinkData[]> {
  const linksRef = db
    .collection('WebLinks')
    .doc(phase)
    .collection(subject)
    .doc(topicId)
    .collection('links');

  const snapshot = await linksRef.orderBy('order', 'asc').get();
  return snapshot.docs.map((doc) => {
    const d = doc.data();
    return {
      title: d.title || '',
      url: d.url || '',
      description: d.description || '',
      order: d.order,
    };
  });
}

async function getAllWebLinksTopics(): Promise<
  Array<{ subject: string; topicId: string; links: LinkData[] }>
> {
  const byKey = new Map<string, LinkData[]>();

  for (const phase of PHASES) {
    const phaseRef = db.collection('WebLinks').doc(phase);
    let cols: admin.firestore.CollectionReference[];
    try {
      cols = await phaseRef.listCollections();
    } catch {
      continue;
    }

    for (const subjectCol of cols) {
      const subject = subjectCol.id;
      const topicSnap = await subjectCol.get();
      for (const topicDoc of topicSnap.docs) {
        const topicId = topicDoc.id;
        const links = await getLinksFromOldStructure(phase, subject, topicId);
        if (links.length > 0) {
          const key = `${subject}/${topicId}`;
          const existing = byKey.get(key) || [];
          const existingUrls = new Set(existing.map((l) => l.url));
          const newLinks = links.filter((l) => !existingUrls.has(l.url));
          byKey.set(key, [...existing, ...newLinks]);
        }
      }
    }
  }

  return Array.from(byKey.entries()).map(([key, links]) => {
    const [subject, topicId] = key.split('/');
    return { subject, topicId, links };
  });
}

async function copyLinksToNewStructure(
  subject: string,
  topicId: string,
  links: LinkData[]
): Promise<number> {
  const topicColRef = db.collection('WebLinks').doc(subject).collection(topicId);

  const batch = db.batch();
  links.slice(0, MAX_LINKS).forEach((link, idx) => {
    const order = idx + 1;
    batch.set(topicColRef.doc(`link${order}`), {
      title: link.title,
      url: link.url,
      description: link.description,
      order,
      savedAt: new Date(),
      topic: topicId,
    }, { merge: true });
  });

  await batch.commit();
  return Math.min(links.length, MAX_LINKS);
}

async function main(): Promise<void> {
  console.log('\n🔄 Migración WebLinks: ruta antigua → WebLinks/{materia}/{topicId}/link1...\n');

  const allTopics = await getAllWebLinksTopics();
  console.log(`📋 Encontrados ${allTopics.length} combinaciones (subject, topicId) con enlaces\n`);

  let totalLinks = 0;
  for (const { subject, topicId, links } of allTopics) {
    const count = await copyLinksToNewStructure(subject, topicId, links);
    totalLinks += count;
    console.log(`   ✅ WebLinks/${subject}/${topicId}/ → ${count} enlaces`);
  }

  console.log(`\n✅ Migración completada: ${totalLinks} enlaces copiados a la nueva estructura.\n`);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
