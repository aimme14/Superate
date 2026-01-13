/**
 * Script para generar definiciones de vocabulario académico de forma masiva
 * 
 * Este script se puede ejecutar manualmente para poblar el banco de vocabulario
 * con definiciones generadas por IA, reduciendo la latencia para los estudiantes
 * 
 * Uso:
 *   npm run generate-vocabulary -- --materia=matematicas --batch-size=20
 *   npm run generate-vocabulary -- --materia=all --batch-size=10
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// Inicializar Firebase Admin si no está inicializado
if (!admin.apps.length) {
  try {
    // Intentar cargar credenciales locales si existen
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('✅ Firebase Admin inicializado con credenciales locales');
    } else {
      // Usar credenciales por defecto (para producción o con GOOGLE_APPLICATION_CREDENTIALS)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('✅ Firebase Admin inicializado con credenciales por defecto');
    }
  } catch (error: any) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    throw error;
  }
}

// Importar servicio después de inicializar Firebase
import { vocabularyService } from '../services/vocabulary.service';

/**
 * Listas de palabras académicas por materia para ICFES Saber 11
 */
const VOCABULARY_WORDS: Record<string, string[]> = {
  matematicas: [
    'álgebra', 'ecuación', 'función', 'derivada', 'integral', 'límite', 'variable', 'constante',
    'polinomio', 'factorización', 'raíz', 'exponente', 'logaritmo', 'trigonometría', 'seno', 'coseno',
    'tangente', 'geometría', 'ángulo', 'perímetro', 'área', 'volumen', 'teorema', 'postulado',
    'axioma', 'proporción', 'razón', 'porcentaje', 'probabilidad', 'estadística', 'media', 'mediana',
    'moda', 'desviación', 'muestra', 'población', 'correlación', 'regresión', 'distribución',
    'combinatoria', 'permutación', 'combinación', 'sucesión', 'progresión', 'aritmética', 'geométrica'
  ],
  lectura_critica: [
    'inferencia', 'deducción', 'inducción', 'argumento', 'tesis', 'hipótesis', 'premisa', 'conclusión',
    'síntesis', 'análisis', 'interpretación', 'comprensión', 'paráfrasis', 'resumen', 'crítica',
    'evaluación', 'juicio', 'razonamiento', 'lógica', 'coherencia', 'cohesión', 'conectores',
    'metáfora', 'símil', 'analogía', 'símbolo', 'alegoría', 'ironía', 'sarcasmo', 'paradoja',
    'hipérbole', 'personificación', 'narrativa', 'descriptiva', 'expositiva', 'argumentativa',
    'persuasiva', 'género', 'subgénero', 'tema', 'tópico', 'tópico oracional', 'estructura',
    'párrafo', 'oración', 'enunciado', 'proposición', 'discurso', 'texto', 'contexto'
  ],
  fisica: [
    'fuerza', 'masa', 'aceleración', 'velocidad', 'movimiento', 'inercia', 'momentum', 'energía',
    'trabajo', 'potencia', 'fricción', 'rozamiento', 'gravedad', 'peso', 'newton', 'joule',
    'ondas', 'frecuencia', 'amplitud', 'longitud de onda', 'período', 'reflexión', 'refracción',
    'difracción', 'interferencia', 'resonancia', 'sonido', 'luz', 'óptica', 'reflexión', 'refracción',
    'lente', 'espejo', 'imagen', 'real', 'virtual', 'campo', 'eléctrico', 'magnético', 'carga',
    'corriente', 'voltaje', 'resistencia', 'circuito', 'ley de ohm', 'termodinámica', 'temperatura',
    'calor', 'entropía', 'energía interna', 'presión', 'volumen', 'gas ideal', 'leyes de newton'
  ],
  biologia: [
    'célula', 'organelo', 'núcleo', 'mitocondria', 'ribosoma', 'membrana', 'citoplasma', 'ADN',
    'ARN', 'gen', 'genoma', 'cromosoma', 'mitosis', 'meiosis', 'replicación', 'transcripción',
    'traducción', 'proteína', 'enzima', 'metabolismo', 'fotosíntesis', 'respiración', 'celular',
    'organismo', 'especie', 'género', 'familia', 'orden', 'clase', 'filo', 'reino', 'taxonomía',
    'evolución', 'selección natural', 'adaptación', 'mutación', 'variación', 'ecosistema',
    'biodiversidad', 'cadena alimentaria', 'red trófica', 'bioma', 'hábitat', 'nicho', 'población',
    'comunidad', 'biósfera', 'homeostasis', 'sistema', 'órgano', 'tejido', 'sistema nervioso',
    'sistema circulatorio', 'sistema digestivo', 'sistema respiratorio', 'sistema endocrino'
  ],
  quimica: [
    'átomo', 'molécula', 'elemento', 'compuesto', 'sustancia', 'mezcla', 'homogénea', 'heterogénea',
    'enlace', 'covalente', 'iónico', 'metálico', 'valencia', 'electronegatividad', 'periodicidad',
    'tabla periódica', 'grupo', 'período', 'metal', 'no metal', 'metaloides', 'reacción',
    'ecuación química', 'balanceo', 'estequiometría', 'mol', 'masa molar', 'concentración',
    'solución', 'soluto', 'solvente', 'ácido', 'base', 'pH', 'neutralización', 'oxidación',
    'reducción', 'agente oxidante', 'agente reductor', 'equilibrio', 'cinética', 'catalizador',
    'energía de activación', 'termoquímica', 'entalpía', 'entropía', 'energía libre', 'orgánica',
    'inorgánica', 'hidrocarburo', 'alcano', 'alqueno', 'alquino', 'alcohol', 'ácido carboxílico',
    'éster', 'éster', 'polímero', 'monómero'
  ],
  ingles: [
    'vocabulary', 'grammar', 'syntax', 'semantics', 'phonetics', 'pronunciation', 'accent',
    'intonation', 'stress', 'syllable', 'verb', 'noun', 'adjective', 'adverb', 'pronoun',
    'preposition', 'conjunction', 'article', 'tense', 'present', 'past', 'future', 'perfect',
    'continuous', 'passive', 'active', 'voice', 'mood', 'conditional', 'subjunctive', 'infinitive',
    'gerund', 'participle', 'clause', 'phrase', 'sentence', 'paragraph', 'essay', 'composition',
    'reading comprehension', 'listening', 'speaking', 'writing', 'fluency', 'accuracy', 'coherence',
    'cohesion', 'register', 'formal', 'informal', 'idiom', 'phrasal verb', 'collocation',
    'synonym', 'antonym', 'homonym', 'prefix', 'suffix', 'root', 'etymology', 'context',
    'inference', 'main idea', 'supporting details', 'topic sentence', 'conclusion'
  ],
  sociales_ciudadanas: [
    'democracia', 'ciudadanía', 'derechos', 'deberes', 'constitución', 'ley', 'norma', 'jurídico',
    'estado', 'gobierno', 'poder', 'ejecutivo', 'legislativo', 'judicial', 'división de poderes',
    'soberanía', 'territorio', 'nación', 'patria', 'identidad', 'cultura', 'tradición', 'costumbre',
    'sociedad', 'comunidad', 'individuo', 'colectivo', 'organización', 'institución', 'sector',
    'público', 'privado', 'economía', 'mercado', 'oferta', 'demanda', 'precio', 'valor',
    'producción', 'consumo', 'distribución', 'comercio', 'exportación', 'importación', 'desarrollo',
    'subdesarrollo', 'globalización', 'regionalización', 'integración', 'cooperación', 'conflicto',
    'negociación', 'diplomacia', 'geografía', 'población', 'migración', 'urbanización', 'rural',
    'ambiente', 'recursos naturales', 'sostenibilidad', 'conservación', 'contaminación', 'historia',
    'historiografía', 'fuente', 'documento', 'archivo', 'cronología', 'periodización', 'causa',
    'consecuencia', 'proceso', 'cambio', 'continuidad', 'revolución', 'reforma', 'independencia'
  ]
};

/**
 * Configuración del script
 */
interface ScriptConfig {
  materia?: string; // 'all' para todas las materias, o nombre específico
  batchSize?: number; // Palabras a procesar por lote
  delayBetweenBatches?: number; // Delay en ms entre lotes
  dryRun?: boolean; // Si es true, solo muestra lo que haría sin ejecutar
  skipExisting?: boolean; // Si es true, omite palabras que ya tienen definición
}

/**
 * Ejecuta el script de generación de vocabulario
 */
async function runScript(config: ScriptConfig = {}) {
  const defaultConfig: ScriptConfig = {
    materia: 'all',
    batchSize: 20,
    delayBetweenBatches: 3000, // 3 segundos entre lotes para evitar rate limits
    dryRun: false,
    skipExisting: true,
    ...config,
  };

  console.log('📚 Iniciando script de generación de vocabulario académico');
  console.log('⚙️ Configuración:', JSON.stringify(defaultConfig, null, 2));
  console.log('');

  if (defaultConfig.dryRun) {
    console.log('⚠️ MODO DRY RUN: No se generarán definiciones reales\n');
  }

  try {
    const startTime = Date.now();

    // Determinar qué materias procesar
    const materiasToProcess = defaultConfig.materia === 'all'
      ? Object.keys(VOCABULARY_WORDS)
      : [defaultConfig.materia!];

    console.log(`📋 Materias a procesar: ${materiasToProcess.length}`);
    materiasToProcess.forEach(m => console.log(`   - ${m}`));
    console.log('');

    let totalWords = 0;
    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const materia of materiasToProcess) {
      const palabras = VOCABULARY_WORDS[materia];
      if (!palabras || palabras.length === 0) {
        console.log(`⚠️ No hay palabras definidas para ${materia}, saltando...\n`);
        continue;
      }

      console.log(`\n📖 Procesando materia: ${materia}`);
      console.log(`   Total de palabras: ${palabras.length}`);

      // Verificar cuántas ya existen
      if (defaultConfig.skipExisting) {
        const existingCount = await vocabularyService.countActiveWords(materia);
        console.log(`   Palabras existentes: ${existingCount}`);
        totalSkipped += existingCount;
      }

      // Dividir en lotes
      const batchSize = defaultConfig.batchSize || 20;
      const batches: string[][] = [];
      for (let i = 0; i < palabras.length; i += batchSize) {
        batches.push(palabras.slice(i, i + batchSize));
      }

      console.log(`   Lotes a procesar: ${batches.length} (${batchSize} palabras por lote)\n`);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`   📦 Lote ${batchIndex + 1}/${batches.length} (${batch.length} palabras)...`);

        if (defaultConfig.dryRun) {
          console.log(`      [DRY RUN] Procesaría: ${batch.join(', ')}`);
          totalWords += batch.length;
          continue;
        }

        try {
          const result = await vocabularyService.generateBatch(materia, batch);

          console.log(`      ✅ Exitosas: ${result.success}`);
          console.log(`      ❌ Fallidas: ${result.failed}`);

          totalWords += batch.length;
          totalGenerated += result.success;
          totalFailed += result.failed;

          // Mostrar detalles de fallos si los hay
          if (result.failed > 0) {
            const failedWords = result.results.filter(r => !r.success);
            failedWords.forEach(fw => {
              console.log(`         ❌ ${fw.palabra}: ${fw.error || 'Error desconocido'}`);
            });
          }

          // Delay entre lotes (excepto el último)
          if (batchIndex < batches.length - 1) {
            const delay = defaultConfig.delayBetweenBatches || 3000;
            console.log(`      ⏳ Esperando ${delay}ms antes del siguiente lote...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error: any) {
          console.error(`      ❌ Error procesando lote: ${error.message}`);
          totalFailed += batch.length;
        }
      }

      console.log(`\n   ✅ Materia ${materia} completada\n`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN FINAL');
    console.log('='.repeat(60));
    console.log(`   Total de palabras procesadas: ${totalWords}`);
    console.log(`   Definiciones generadas: ${totalGenerated}`);
    console.log(`   Palabras omitidas (ya existían): ${totalSkipped}`);
    console.log(`   Fallos: ${totalFailed}`);
    console.log(`   Tiempo total: ${duration}s`);
    console.log('='.repeat(60));

    if (defaultConfig.dryRun) {
      console.log('\n⚠️ Este fue un DRY RUN. Ejecuta sin --dry-run para generar las definiciones reales.');
    }

  } catch (error: any) {
    console.error('\n❌ Error ejecutando script:', error);
    process.exit(1);
  }
}

// Ejecutar script si se llama directamente
if (require.main === module) {
  // Parsear argumentos de línea de comandos
  const args = process.argv.slice(2);
  const config: ScriptConfig = {};

  args.forEach(arg => {
    if (arg.startsWith('--materia=')) {
      config.materia = arg.split('=')[1];
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--delay=')) {
      config.delayBetweenBatches = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--no-skip-existing') {
      config.skipExisting = false;
    }
  });

  runScript(config)
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Script falló:', error);
      process.exit(1);
    });
}

export { runScript, VOCABULARY_WORDS };
