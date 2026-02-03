/**
 * Script de migración: YoutubeLinks (ruta antigua) → YoutubeLinks (ruta nueva)
 *
 * Copia los videos de la estructura antigua a la nueva:
 *   Antes: YoutubeLinks/{Fase I|II|III}/{subject}/{topicId}/videos/video01...video20
 *   Nueva:  YoutubeLinks/{materia}/{topicId}/video1, video2...
 *
 * Caché global por materia y topic (sin fase ni studentId).
 *
 * Uso:
 *   npm run build
 *   node lib/scripts/migrateVideosToAnswerIA.js
 *
 * Requiere: serviceAccountKey.json en functions/ (o GOOGLE_APPLICATION_CREDENTIALS)
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const PHASES = ['Fase I', 'Fase II', 'Fase III'];
const MAX_VIDEOS = 20;

function initializeFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  let credential: admin.credential.Credential;
  let projectId = process.env.FIREBASE_PROJECT_ID || '';

  // 1) GOOGLE_APPLICATION_CREDENTIALS: usa el archivo indicado (ej: serviceAccountKey-superate-ia.json)
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
    // 2) serviceAccountKey.json en functions/
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

interface VideoData {
  title: string;
  url: string;
  description: string;
  channelTitle: string;
  videoId?: string;
  duration?: string;
  language?: string;
}

function parseVideoFromDoc(data: admin.firestore.DocumentData): VideoData {
  return {
    title: data.título || data.title || '',
    url: data.url || `https://www.youtube.com/watch?v=${data.videoId || ''}`,
    description: data.description || '',
    channelTitle: data.canal || data.channelTitle || '',
    videoId: data.videoId || '',
    duration: data.duración || data.duration || '',
    language: data.idioma || data.language || 'es',
  };
}

async function getVideosFromYoutubeLinks(
  phase: string,
  subject: string,
  topicId: string
): Promise<VideoData[]> {
  const topicRef = db
    .collection('YoutubeLinks')
    .doc(phase)
    .collection(subject)
    .doc(topicId);
  const videos: VideoData[] = [];
  for (let i = 1; i <= MAX_VIDEOS; i++) {
    const vidId = `video${String(i).padStart(2, '0')}`;
    const snap = await topicRef.collection('videos').doc(vidId).get();
    if (snap.exists && snap.data()) {
      videos.push(parseVideoFromDoc(snap.data()!));
    }
  }
  return videos;
}

async function getAllYoutubeLinksTopics(): Promise<
  Array<{ phase: string; subject: string; topicId: string; videos: VideoData[] }>
> {
  const results: Array<{ phase: string; subject: string; topicId: string; videos: VideoData[] }> = [];
  const ytRef = db.collection('YoutubeLinks');

  for (const phase of PHASES) {
    const phaseRef = ytRef.doc(phase);
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
        const videos = await getVideosFromYoutubeLinks(phase, subject, topicId);
        if (videos.length > 0) {
          results.push({ phase, subject, topicId, videos });
        }
      }
    }
  }
  return results;
}

async function copyVideosToNewStructure(
  subject: string,
  topicId: string,
  videos: VideoData[]
): Promise<number> {
  const topicColRef = db.collection('YoutubeLinks').doc(subject).collection(topicId);

  const batch = db.batch();
  videos.forEach((video, idx) => {
    if (idx >= MAX_VIDEOS) return;
    const vidDocId = `video${idx + 1}`;
    let videoId = video.videoId || '';
    if (!videoId && video.url) {
      const m = video.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (m) videoId = m[1];
    }
    const videoRef = topicColRef.doc(vidDocId);
    batch.set(
      videoRef,
      {
        videoId,
        título: video.title,
        canal: video.channelTitle,
        duración: video.duration || '',
        idioma: video.language || 'es',
        title: video.title,
        channelTitle: video.channelTitle,
        duration: video.duration || '',
        language: video.language || 'es',
        url: video.url,
        description: video.description || '',
        order: idx + 1,
        savedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedFrom: 'YoutubeLinks-Fase',
      },
      { merge: true }
    );
  });
  await batch.commit();
  return Math.min(videos.length, MAX_VIDEOS);
}

async function run(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  📦 Migración: YoutubeLinks (Fase) → YoutubeLinks (materia/topic)');
  console.log('═══════════════════════════════════════════════════════════\n');

  const youtubeTopics = await getAllYoutubeLinksTopics();
  console.log(`📹 Topics con videos (ruta antigua): ${youtubeTopics.length}\n`);

  if (youtubeTopics.length === 0) {
    console.log('⚠️ No hay videos en YoutubeLinks/{Fase}/{subject}/... Nada que migrar.');
    console.log('   Verifica: FIREBASE_PROJECT_ID=superate-ia si tus datos están ahí');
    return;
  }

  const subjectTopicToVideos = new Map<string, VideoData[]>();
  for (const t of youtubeTopics) {
    const key = `${t.subject}::${t.topicId}`;
    if (!subjectTopicToVideos.has(key) || (subjectTopicToVideos.get(key)!.length < t.videos.length)) {
      subjectTopicToVideos.set(key, t.videos);
    }
  }

  let copied = 0;
  let skipped = 0;

  for (const [key, videos] of subjectTopicToVideos) {
    const [subject, topicId] = key.split('::');
    const destRef = db.collection('YoutubeLinks').doc(subject).collection(topicId).doc('video1');
    const existing = await destRef.get();
    if (existing.exists) {
      skipped++;
      continue;
    }
    const n = await copyVideosToNewStructure(subject, topicId, videos);
    copied += n;
    console.log(`   ✅ ${subject} / ${topicId}: ${n} videos`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  ✅ Migración completada`);
  console.log(`  Copiados: ${copied} topic(s)`);
  console.log(`  Omitidos (ya existían): ${skipped}`);
  console.log('  Nueva ruta: YoutubeLinks/{materia}/{topicId}/video1, video2...');
  console.log('═══════════════════════════════════════════════════════════\n');
}

run().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
