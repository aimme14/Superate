import { PHILOSOPHICAL_QUOTES, BIBLE_VERSES } from '../constants';

/** Genera un índice determinístico basado en un string (ej. studentId). */
const getIndex = (str: string, len: number): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % len;
};

export const generatePhase1And2PDFHTML = (
  summary: any,
  studentName: string,
  studentId: string,
  institutionName: string,
  currentDate: Date,
  phaseName: string,
  phaseMetrics: {
    globalScore: number;
    phasePercentage: number;
    averageTimePerQuestion: number;
    fraudAttempts: number;
    luckPercentage: number;
    completedSubjects: number;
    totalQuestions: number;
  },
  studentRank: number | null,
  totalStudents: number | null,
  subjectScores: Array<{ name: string; score: number; percentage: number }>
): string => {
  // Convertir tiempo promedio a formato legible (0.1m)
  const timeMinutes = phaseMetrics.averageTimePerQuestion.toFixed(1);

  const selectedQuote = PHILOSOPHICAL_QUOTES[getIndex(studentId, PHILOSOPHICAL_QUOTES.length)];
  const selectedVerse = BIBLE_VERSES[getIndex(studentId + 'verse', BIBLE_VERSES.length)];

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
      <title>Resumen Académico - ${phaseName} - ${studentName}</title>
        <style>
            @page {
          size: Letter;
          margin: 1.5cm 1.5cm 1.5cm 1.5cm;
            }
        * {
              margin: 0;
          padding: 0;
          box-sizing: border-box;
          }
          body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #000;
          background: #fff;
        }
        .pdf-container {
          width: 100%;
          max-width: 17cm;
            margin: 0 auto;
          }
          .header {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 15px;
          border-top: 3px solid #1e40af;
          border-bottom: 3px solid #1e40af;
          padding: 12px;
          margin-bottom: 15px;
          position: relative;
        }
        .header-logo {
          width: 100px;
          height: 100px;
          object-fit: contain;
          flex-shrink: 0;
        }
        .header-text {
          text-align: center;
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 130px);
        }
        .header-text h1 {
          font-size: 19pt;
          font-weight: bold;
          color: #000;
          margin-bottom: 5px;
          text-align: center;
        }
        .header-text .subtitle {
          font-size: 11pt;
          color: #1e40af;
          font-weight: bold;
          text-align: center;
        }
        .student-info {
          background-color: #f3f4f6;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          margin-bottom: 15px;
          font-size: 8pt;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px 15px;
        }
        .student-info p {
          margin: 0;
          line-height: 1.4;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin-bottom: 15px;
          page-break-inside: avoid;
        }
        .metric-card {
          background-color: transparent;
          color: #000;
          padding: 6px;
          border: 2px solid #1e40af;
          border-radius: 6px;
          position: relative;
          min-width: 0;
        }
        .metric-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 4px;
          gap: 4px;
        }
        .metric-card-title {
          font-size: 6pt;
          font-weight: bold;
          color: #374151;
          line-height: 1.2;
          flex: 1;
        }
        .metric-card-icon {
          font-size: 11pt;
          flex-shrink: 0;
        }
        .metric-card-value {
          font-size: 15pt;
          font-weight: bold;
          margin-bottom: 3px;
          line-height: 1;
        }
        .metric-card-detail {
          background-color: #f3f4f6;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 5pt;
          border: 1px solid #d1d5db;
          line-height: 1.2;
          word-wrap: break-word;
          color: #6b7280;
        }
        .metric-card-value.global {
          color: #1e40af;
        }
        .metric-card-value.rank {
          color: #3b82f6;
        }
        .metric-card-value.time {
          color: #1e40af;
        }
        .metric-card-value.fraud {
          color: #ef4444;
        }
        .metric-card-value.luck {
          color: #f59e0b;
        }
        .subject-scores-box {
          border: 2px solid #1e40af;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 15px;
          background-color: #f9fafb;
          page-break-inside: avoid;
        }
        .subject-scores-title {
          font-size: 11pt;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 10px;
          text-align: center;
        }
        .subject-scores-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        .subject-score-item {
          text-align: center;
          padding: 6px 4px;
          background-color: #fff;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }
        .subject-score-name {
          font-size: 6pt;
          font-weight: bold;
          color: #374151;
          margin-bottom: 3px;
          line-height: 1.2;
          word-break: break-word;
          hyphens: auto;
          text-align: center;
        }
        .subject-score-value {
          font-size: 13pt;
          font-weight: bold;
          color: #1e40af;
          line-height: 1;
        }
          .section {
            margin-bottom: 20px;
          page-break-inside: avoid;
          }
          .section h2 {
          font-size: 15pt;
          font-weight: bold;
            color: #1e40af;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .section h3 {
          font-size: 13pt;
          font-weight: bold;
            color: #3b82f6;
            margin-top: 15px;
            margin-bottom: 8px;
          }
          .section p {
            text-align: justify;
            margin-bottom: 12px;
          font-size: 10pt;
          }
          ul, ol {
          margin-left: 25px;
            margin-bottom: 12px;
          }
          li {
            margin-bottom: 6px;
          font-size: 10pt;
        }
        .fortalezas {
          background-color: #d1fae5;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #10b981;
          page-break-inside: avoid;
        }
        .mejoras {
          background-color: #fef3c7;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #f59e0b;
          page-break-inside: avoid;
        }
        .recomendaciones {
          background-color: #dbeafe;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #3b82f6;
          page-break-inside: avoid;
          }
        .metadata {
          background-color: #f3f4f6;
          padding: 15px;
          border: 1px solid #d1d5db;
          margin-top: 30px;
          font-size: 9pt;
          color: #4b5563;
          page-break-inside: avoid;
        }
        .inspirational-section {
          margin-top: 25px;
          text-align: center;
          padding: 15px 15px;
          page-break-inside: avoid;
        }
        .philosophical-quote {
          font-style: italic;
          font-size: 10pt;
          color: #374151;
          margin-bottom: 15px;
          line-height: 1.6;
          font-family: Georgia, serif;
        }
        .bible-verse {
          font-size: 11pt;
          color: #1e40af;
          font-weight: bold;
          font-style: italic;
          line-height: 1.6;
          margin-top: 10px;
        }
        .inspirational-section {
          margin-top: 25px;
          text-align: center;
          padding: 15px 15px;
          page-break-inside: avoid;
        }
        .philosophical-quote {
          font-style: italic;
          font-size: 10pt;
          color: #374151;
          margin-bottom: 15px;
          line-height: 1.6;
          font-family: Georgia, serif;
        }
        .bible-verse {
          font-size: 11pt;
          color: #1e40af;
          font-weight: bold;
          font-style: italic;
          line-height: 1.6;
          margin-top: 10px;
        }
        .page-break {
          page-break-before: always;
        }
        @media print {
          .page-break {
            page-break-before: always;
          }
          .section {
            page-break-inside: avoid;
          }
          .metrics-grid {
            page-break-inside: avoid;
            grid-template-columns: repeat(5, 1fr);
          }
        }
      </style>
    </head>
    <body>
      <div class="pdf-container">
        <!-- Encabezado con Logo -->
        <div class="header">
          <img src="/assets/logo_tematica_blanca.png" alt="SUPERATE.IA" class="header-logo" onerror="this.style.display='none'; this.nextElementSibling.style.marginLeft='0';" />
          <div class="header-text">
            <h1>SUPERATE.IA</h1>
            <div class="subtitle">REPORTE DE RESULTADOS ESTUDIANTE</div>
          </div>
        </div>

        <!-- Información del Estudiante -->
        <div class="student-info">
          <p><strong>${phaseName === 'Fase I' ? 'Fase I - Diagnóstico de Habilidades Académicas' : phaseName === 'Fase II' ? 'Fase II - Refuerzo Personalizado' : 'Fase III - Simulacro ICFES'}</strong></p>
          <p><strong>Fecha de publicación de resultados:</strong> ${currentDate.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }).toUpperCase()}</p>
          <p><strong>Apellidos y nombres:</strong> ${studentName.toUpperCase()}</p>
          <p><strong>Institución educativa:</strong> ${institutionName || 'No especificada'}</p>
          ${(() => {
            const grado = summary.contextoAcademico?.grado;
            // Detectar si es un ID técnico (patrón: texto-números-números)
            const isTechnicalId = grado && /^[a-zA-Z0-9]+-\d+-\d+$/.test(grado);
            // Solo mostrar si no es un ID técnico
            return grado && !isTechnicalId ? `<p><strong>Grado:</strong> ${grado}</p>` : '';
          })()}
        </div>

        <!-- Tarjetas de Métricas -->
        <div class="metrics-grid">
          <!-- Puntaje Global -->
          <div class="metric-card global">
            <div class="metric-card-header">
              <div class="metric-card-title">Puntaje Global</div>
              <div class="metric-card-icon">🏅</div>
            </div>
            <div class="metric-card-value global">${phaseMetrics.globalScore}</div>
            <div class="metric-card-detail">De 500 puntos</div>
          </div>

          <!-- Puesto entre estudiantes -->
          <div class="metric-card rank">
            <div class="metric-card-header">
              <div class="metric-card-title">Puesto</div>
              <div class="metric-card-icon">📊</div>
            </div>
            <div class="metric-card-value rank">${studentRank !== null && totalStudents !== null ? `${studentRank}°` : 'N/A'}</div>
            <div class="metric-card-detail">${studentRank !== null && totalStudents !== null ? `De ${totalStudents} estudiantes` : 'No disponible'}</div>
          </div>

          <!-- Tiempo Promedio por Pregunta -->
          <div class="metric-card time">
            <div class="metric-card-header">
              <div class="metric-card-title">Tiempo Promedio</div>
              <div class="metric-card-icon">⏱️</div>
            </div>
            <div class="metric-card-value time">${timeMinutes}m</div>
            <div class="metric-card-detail">Por pregunta</div>
          </div>

          <!-- Intento de Fraude -->
          <div class="metric-card fraud">
            <div class="metric-card-header">
              <div class="metric-card-title">Intento de fraude</div>
              <div class="metric-card-icon">🛡️</div>
            </div>
            <div class="metric-card-value fraud">${phaseMetrics.fraudAttempts}</div>
            <div class="metric-card-detail">${phaseMetrics.fraudAttempts === 1 ? '1 evaluación' : `${phaseMetrics.fraudAttempts} evaluaciones`}</div>
          </div>

          <!-- Porcentaje de Suerte -->
          <div class="metric-card luck">
            <div class="metric-card-header">
              <div class="metric-card-title">Porcentaje de Suerte</div>
              <div class="metric-card-icon">⚡</div>
            </div>
            <div class="metric-card-value luck">${phaseMetrics.luckPercentage}%</div>
            <div class="metric-card-detail">${phaseMetrics.luckPercentage >= 50 ? 'Muchas rápidas' : phaseMetrics.luckPercentage >= 20 ? 'Algunas rápidas' : 'Pocas rápidas'}</div>
          </div>
        </div>

        <!-- Puntajes por Materia -->
        <div class="subject-scores-box">
          <div class="subject-scores-title">Puntaje por Materia</div>
          <div class="subject-scores-grid">
            ${subjectScores.map(subj => `
              <div class="subject-score-item">
                <div class="subject-score-name">${subj.name}</div>
                <div class="subject-score-value">${subj.score}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Resumen General -->
        <div class="section">
          <h2>Resumen General</h2>
          <p>${summary.resumen.resumen_general}</p>
        </div>

        <!-- Diagnóstico de Desempeño Académico -->
        <div class="section">
          <h2>Diagnóstico de Desempeño Académico</h2>
          ${(() => {
            // Verificar si analisis_competencial es un objeto (estructura nueva) o string (backward compatibility)
            if (typeof summary.resumen.analisis_competencial === 'object' && summary.resumen.analisis_competencial !== null) {
              // Estructura nueva: objeto por materias
              const analisisPorMaterias = summary.resumen.analisis_competencial as { [materia: string]: string };
              return subjectScores.map(subj => {
                // Buscar el análisis de esta materia (probando diferentes variaciones del nombre)
                const analisisMateria = analisisPorMaterias[subj.name] || 
                                       analisisPorMaterias[subj.name.toLowerCase()] ||
                                       Object.entries(analisisPorMaterias).find(([key]) => 
                                         key.toLowerCase() === subj.name.toLowerCase()
                                       )?.[1] || '';
                if (analisisMateria) {
                  return `
                    <div style="margin-bottom: 15px;">
                      <h3 style="font-size: 12pt; font-weight: bold; color: #1e40af; margin-bottom: 8px;">${subj.name}:</h3>
                      <p style="text-align: justify; line-height: 1.6;">${analisisMateria}</p>
                    </div>
                  `;
                }
                return '';
              }).filter(html => html).join('');
            } else {
              // Backward compatibility: si es string, mostrar el texto completo
              return `<p style="text-align: justify; line-height: 1.6;">${summary.resumen.analisis_competencial}</p>`;
            }
          })()}
        </div>

        <!-- Fortalezas Académicas -->
        <div class="section fortalezas">
          <h3>Fortalezas Académicas</h3>
          <ul>
            ${summary.resumen.fortalezas_academicas.map((f: string) => `<li>${f}</li>`).join('')}
          </ul>
        </div>

        <!-- Aspectos por Mejorar -->
        <div class="section mejoras">
          <h3>Aspectos por Mejorar</h3>
          <ul>
            ${summary.resumen.aspectos_por_mejorar.map((a: string) => `<li>${a}</li>`).join('')}
          </ul>
        </div>

        <!-- Recomendaciones -->
        <div class="section recomendaciones">
          <h3>Recomendaciones - Enfoque Saber 11</h3>
          <ul>
            ${summary.resumen.recomendaciones_enfoque_saber11.map((r: string) => `<li>${r}</li>`).join('')}
          </ul>
        </div>

        ${summary.metricasGlobales ? `
        <!-- Métricas de Desempeño -->
        <div class="section">
          <h2>Métricas de Desempeño</h2>
          <p><strong>Nivel general:</strong> ${summary.metricasGlobales.nivelGeneralDesempeno}</p>
          ${summary.metricasGlobales.materiasFuertes.length > 0 ? `
            <p><strong>Materias con desempeño favorable:</strong> ${summary.metricasGlobales.materiasFuertes.join(', ')}</p>
          ` : ''}
          ${summary.metricasGlobales.materiasDebiles.length > 0 ? `
            <p><strong>Materias que requieren fortalecimiento:</strong> ${summary.metricasGlobales.materiasDebiles.join(', ')}</p>
          ` : ''}
        </div>
        ` : ''}

        <!-- Frase Inspiradora -->
        <div class="inspirational-section">
          <div class="philosophical-quote">
            "${selectedQuote.quote}"
          </div>
          <div class="bible-verse">
            "${selectedVerse.verse}"<br>
            <span style="font-size: 8pt; color: #6b7280;">${selectedVerse.reference}</span>
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `;
};
