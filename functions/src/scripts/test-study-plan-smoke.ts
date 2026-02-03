/**
 * Smoke test: verifica que el servicio de plan de estudio y la nueva estructura cargan correctamente.
 * Ejecutar: npx ts-node src/scripts/test-study-plan-smoke.ts (desde functions/)
 * O: node lib/scripts/test-study-plan-smoke.js (después de build)
 */

import {
  getCanonicalTopicsWithWeakness,
  mapToCanonicalTopic,
  MAX_VIDEOS_PER_TOPIC,
  VIDEOS_PER_TOPIC,
  SUBJECTS_CONFIG,
} from '../config/subjects.config';

function smokeTest(): void {
  console.log('🧪 Smoke test: subjects.config y lógica de topics canónicos\n');

  // 1. Config carga
  console.log('✓ SUBJECTS_CONFIG:', SUBJECTS_CONFIG.length, 'materias');
  console.log('✓ MAX_VIDEOS_PER_TOPIC:', MAX_VIDEOS_PER_TOPIC);
  console.log('✓ VIDEOS_PER_TOPIC:', VIDEOS_PER_TOPIC);

  // 2. mapToCanonicalTopic
  const mathTopic = mapToCanonicalTopic('Matemáticas', 'Ecuaciones cuadráticas');
  console.log('\n✓ mapToCanonicalTopic(Matemáticas, Ecuaciones cuadráticas):', mathTopic);
  const exactTopic = mapToCanonicalTopic('Matemáticas', 'Álgebra y Cálculo');
  console.log('✓ mapToCanonicalTopic(Matemáticas, Álgebra y Cálculo):', exactTopic);

  // 3. getCanonicalTopicsWithWeakness
  const weaknesses = ['Ecuaciones cuadráticas', 'Geometría plana', 'Estadistica'];
  const canonical = getCanonicalTopicsWithWeakness('Matemáticas', weaknesses);
  console.log('\n✓ getCanonicalTopicsWithWeakness(Matemáticas, weaknesses):', canonical);

  console.log('\n✅ Smoke test completado sin errores.');
}

smokeTest();
