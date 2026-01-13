# Instrucciones para Agregar Función Programada de Vocabulario

## ✅ Lo que ya está implementado:

1. ✅ Servicio de vocabulario (`vocabulary.service.ts`)
2. ✅ Endpoints HTTP para vocabulario
3. ✅ Script de generación manual (`generateVocabulary.ts`)
4. ✅ Componente frontend (`VocabularyBank.tsx`)
5. ✅ Integración en el plan de estudio

## 📝 Pendiente: Agregar función programada

Debes agregar manualmente la siguiente función en `functions/src/index.ts` después de la línea 405 (después de `scheduledJustificationGeneration`):

```typescript
/**
 * Función programada para generar vocabulario académico
 * Se ejecuta semanalmente los domingos a las 3:00 AM
 */
export const scheduledVocabularyGeneration = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .pubsub.schedule('0 3 * * 0') // Cron: 3:00 AM todos los domingos
  .timeZone('America/Bogota')
  .onRun(async (_context) => {
    console.log('📚 Ejecutando generación programada de vocabulario académico...');
    
    try {
      const materias = [
        'matematicas',
        'lectura_critica',
        'fisica',
        'biologia',
        'quimica',
        'ingles',
        'sociales_ciudadanas'
      ];

      const MIN_WORDS_THRESHOLD = 100;
      const BATCH_SIZE = 20;
      
      let totalGenerated = 0;
      let totalSkipped = 0;
      const results: Array<{ materia: string; generated: number; skipped: number }> = [];

      for (const materia of materias) {
        try {
          const existingCount = await vocabularyService.countActiveWords(materia);
          console.log(`📖 ${materia}: ${existingCount} palabras existentes`);

          if (existingCount >= MIN_WORDS_THRESHOLD) {
            console.log(`   ✅ ${materia} tiene suficientes palabras, saltando...`);
            totalSkipped += existingCount;
            results.push({ materia, generated: 0, skipped: existingCount });
            continue;
          }

          const wordsNeeded = MIN_WORDS_THRESHOLD - existingCount;
          const wordsToGenerate = Math.min(BATCH_SIZE, wordsNeeded);
          
          console.log(`   📝 ${materia} necesita más palabras. Generando ${wordsToGenerate}...`);

          const commonWords: Record<string, string[]> = {
            matematicas: ['álgebra', 'ecuación', 'función', 'derivada', 'integral', 'límite', 'variable', 'constante', 'polinomio', 'factorización', 'raíz', 'exponente', 'logaritmo', 'trigonometría', 'seno', 'coseno', 'tangente', 'geometría', 'ángulo', 'perímetro'],
            lectura_critica: ['inferencia', 'deducción', 'argumento', 'tesis', 'hipótesis', 'premisa', 'conclusión', 'síntesis', 'análisis', 'interpretación', 'comprensión', 'paráfrasis', 'resumen', 'crítica', 'evaluación', 'juicio', 'razonamiento', 'lógica', 'coherencia', 'cohesión'],
            fisica: ['fuerza', 'masa', 'aceleración', 'velocidad', 'movimiento', 'inercia', 'momentum', 'energía', 'trabajo', 'potencia', 'fricción', 'rozamiento', 'gravedad', 'peso', 'newton', 'joule', 'ondas', 'frecuencia', 'amplitud', 'longitud de onda'],
            biologia: ['célula', 'organelo', 'núcleo', 'mitocondria', 'ribosoma', 'membrana', 'citoplasma', 'ADN', 'ARN', 'gen', 'genoma', 'cromosoma', 'mitosis', 'meiosis', 'replicación', 'transcripción', 'traducción', 'proteína', 'enzima', 'metabolismo'],
            quimica: ['átomo', 'molécula', 'elemento', 'compuesto', 'sustancia', 'mezcla', 'enlace', 'valencia', 'reacción', 'ecuación química', 'balanceo', 'estequiometría', 'mol', 'masa molar', 'concentración', 'solución', 'soluto', 'solvente', 'ácido', 'base'],
            ingles: ['vocabulary', 'grammar', 'syntax', 'semantics', 'pronunciation', 'verb', 'noun', 'adjective', 'adverb', 'tense', 'present', 'past', 'future', 'perfect', 'continuous', 'passive', 'active', 'voice', 'mood', 'conditional'],
            sociales_ciudadanas: ['democracia', 'ciudadanía', 'derechos', 'deberes', 'constitución', 'ley', 'estado', 'gobierno', 'poder', 'soberanía', 'territorio', 'nación', 'patria', 'identidad', 'cultura', 'sociedad', 'comunidad', 'economía', 'mercado', 'oferta']
          };

          const wordsForMateria = commonWords[materia] || [];
          const wordsToProcess = wordsForMateria.slice(0, wordsToGenerate);

          if (wordsToProcess.length === 0) {
            console.log(`   ⚠️ No hay palabras definidas para ${materia}`);
            continue;
          }

          const batchResult = await vocabularyService.generateBatch(materia, wordsToProcess);
          
          console.log(`   ✅ ${materia}: ${batchResult.success} exitosas, ${batchResult.failed} fallidas`);
          
          totalGenerated += batchResult.success;
          results.push({ 
            materia, 
            generated: batchResult.success, 
            skipped: existingCount 
          });

          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error: any) {
          console.error(`   ❌ Error procesando ${materia}:`, error.message);
          results.push({ materia, generated: 0, skipped: 0 });
        }
      }

      const summary = {
        success: true,
        totalGenerated,
        totalSkipped,
        results,
        timestamp: new Date(),
      };

      console.log('✅ Generación programada de vocabulario completada:', summary);
      
      return summary;
    } catch (error: any) {
      console.error('❌ Error en generación programada de vocabulario:', error);
      throw error;
    }
  });
```

## 🚀 Pasos para completar:

1. Abre `functions/src/index.ts`
2. Busca la línea 405 (después de `scheduledJustificationGeneration`)
3. Inserta el código de arriba antes de `// ============================= // FUNCIONES DE UTILIDAD`
4. Compila: `npm run build`
5. Despliega: `firebase deploy --only functions:scheduledVocabularyGeneration`

## 📋 Resumen de lo implementado:

- ✅ Script manual: `npm run generate-vocabulary`
- ✅ Endpoints HTTP: `/getVocabularyWords`, `/getVocabularyWord`, `/generateVocabularyBatch`
- ✅ Componente frontend integrado en plan de estudio
- ⏳ Función programada: Pendiente de agregar manualmente (código listo arriba)
