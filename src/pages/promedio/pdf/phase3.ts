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

const getRankTrophyAndColors = (rank: number) => {
  if (rank === 1) {
    return {
      trophy: '🏆',
      bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      borderColor: '#fbbf24',
      textColor: '#92400e',
      detailColor: '#78350f'
    };
  } else if (rank === 2) {
    return {
      trophy: '🥈',
      bgGradient: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
      borderColor: '#94a3b8',
      textColor: '#475569',
      detailColor: '#334155'
    };
  } else if (rank === 3) {
    return {
      trophy: '🥉',
      bgGradient: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
      borderColor: '#fb923c',
      textColor: '#9a3412',
      detailColor: '#7c2d12'
    };
  } else {
    return {
      trophy: '🏅',
      bgGradient: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
      borderColor: '#9ca3af',
      textColor: '#4b5563',
      detailColor: '#374151'
    };
  }
};

const getPerformanceLevel = (score: number): { level: string; definition: string } => {
  if (score >= 80) {
    return {
      level: 'Nivel Alto',
      definition: 'Demuestra dominio adecuado de las competencias evaluadas.'
    };
  } else if (score >= 60) {
    return {
      level: 'Nivel Medio',
      definition: 'Evidencia comprensión adecuada de los contenidos evaluados con algunas áreas de mejora.'
    };
  } else if (score >= 40) {
    return {
      level: 'Nivel Básico',
      definition: 'Evidencia comprensión parcial de los contenidos fundamentales.'
    };
  } else {
    return {
      level: 'Nivel Bajo',
      definition: 'Requiere refuerzo en los contenidos fundamentales de la materia.'
    };
  }
};

export const generatePhase3PDFHTML = (
  summary: any,
  studentName: string,
  studentId: string,
  institutionName: string,
  currentDate: Date,
  sortedSubjects: any[],
  globalScore: number,
  _globalPercentile: number,
  phase1Subjects?: Array<{ name: string; percentage: number }>,
  phase2Subjects?: Array<{ name: string; percentage: number }>,
  _phaseMetrics?: { averageTimePerQuestion: number; fraudAttempts: number; luckPercentage: number },
  studentRank?: number | null,
  totalStudents?: number | null
): string => {
  const selectedQuote = PHILOSOPHICAL_QUOTES[getIndex(studentId, PHILOSOPHICAL_QUOTES.length)];
  const selectedVerse = BIBLE_VERSES[getIndex(studentId + 'verse', BIBLE_VERSES.length)];

  // Preparar datos para las gráficas
  const phase3Subjects = sortedSubjects.map(s => ({ name: s.name, percentage: s.percentage }));

  // Función helper para generar SVG del gráfico de evolución
  const generateEvolutionChartSVG = () => {
    const width = 600;
    const height = 240;
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const subjects = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés'];
    const colors = ['#3b82f6', '#9333ea', '#22c55e', '#fbbf24', '#ef4444', '#fb923c', '#06b6d4'];

    const allValues = [
      ...(phase1Subjects || []).map(s => s.percentage),
      ...(phase2Subjects || []).map(s => s.percentage),
      ...phase3Subjects.map(s => s.percentage)
    ];
    const maxValue = Math.max(...allValues, 100);

    const getValue = (phase: 'phase1' | 'phase2' | 'phase3', subjectName: string) => {
      const data = phase === 'phase1' ? phase1Subjects : phase === 'phase2' ? phase2Subjects : phase3Subjects;
      if (!data) return null;
      const subject = data.find(s => s.name === subjectName);
      return subject ? subject.percentage : null;
    };

    const phasePositions = { phase1: chartWidth * 0.05, phase2: chartWidth * 0.5, phase3: chartWidth * 0.95 };
    const dataPositions = { phase1: chartWidth * 0.0, phase2: chartWidth * 0.5, phase3: chartWidth * 0.9 };
    const scaleY = (value: number) => chartHeight - (value / maxValue) * chartHeight;

    let lines = '';
    let dots = '';
    let labels = '';

    subjects.forEach((subject, subjectIndex) => {
      const color = colors[subjectIndex % colors.length];
      const points: Array<{ x: number; y: number; value: number | null }> = [];

      ['phase1', 'phase2', 'phase3'].forEach(phase => {
        const value = getValue(phase as 'phase1' | 'phase2' | 'phase3', subject);
        if (value !== null) {
          points.push({
            x: dataPositions[phase as keyof typeof dataPositions],
            y: scaleY(value),
            value
          });
        }
      });

      if (points.length > 1) {
        let path = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          const prevPoint = points[i - 1];
          const currPoint = points[i];
          const cp1x = prevPoint.x + (currPoint.x - prevPoint.x) * 0.5;
          const cp1y = prevPoint.y;
          const cp2x = prevPoint.x + (currPoint.x - prevPoint.x) * 0.5;
          const cp2y = currPoint.y;
          path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${currPoint.x} ${currPoint.y}`;
        }
        lines += `<path d="${path}" stroke="${color}" stroke-width="2" fill="none"/>`;
      }

      points.forEach(point => {
        if (point.value !== null) {
          dots += `<circle cx="${point.x}" cy="${point.y}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>`;
        }
      });
    });

    labels += `<text x="${phasePositions.phase1}" y="${chartHeight + 18}" text-anchor="middle" font-size="12" fill="#e5e7eb" font-weight="500">Fase I</text>`;
    labels += `<text x="${phasePositions.phase2}" y="${chartHeight + 18}" text-anchor="middle" font-size="12" fill="#e5e7eb" font-weight="500">Fase II</text>`;
    labels += `<text x="${phasePositions.phase3}" y="${chartHeight + 18}" text-anchor="middle" font-size="12" fill="#e5e7eb" font-weight="500">Fase III</text>`;

    let gridLines = '';
    for (let i = 0; i <= 5; i++) {
      const y = (chartHeight / 5) * i;
      const value = maxValue - (maxValue / 5) * i;
      gridLines += `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#4b5563" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>`;
      gridLines += `<text x="-10" y="${y + 4}" text-anchor="end" font-size="11" fill="#9ca3af" font-weight="500">${Math.round(value)}</text>`;
    }

    const legendItems = subjects.map((subject, index) => {
      const color = colors[index % colors.length];
      const availableWidth = width - margin.left - margin.right - 10;
      const spacing = availableWidth / 6;
      const x = margin.left + (index * spacing) + 2;
      const y = margin.top + chartHeight + 42 + Math.floor(index / 7) * 18;
      return `<circle cx="${x}" cy="${y}" r="4" fill="${color}"/>
              <text x="${x + 8}" y="${y + 4}" font-size="10" fill="#e5e7eb">${subject.length > 15 ? subject.substring(0, 15) + '...' : subject}</text>`;
    }).join('');

    return `<svg width="100%" height="${height + 40}" viewBox="0 0 ${width} ${height + 40}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="background-color: #2d2d2d; display: block; min-height: ${height + 40}px;">
      <rect width="100%" height="100%" fill="#2d2d2d"/>
      <g transform="translate(${margin.left},${margin.top})">
        ${gridLines}
        ${lines}
        ${dots}
        ${labels}
      </g>
      <g>${legendItems}</g>
    </svg>`;
  };

  const evolutionSVG = phase1Subjects && phase2Subjects ? generateEvolutionChartSVG() : null;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>REPORTE DE RESULTADOS ESTUDIANTE • SABER 11° - ${studentName}</title>
      <style>
        @page {
          size: Letter;
          margin: 2.5cm 2cm 2.5cm 2cm;
        }
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12pt;
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
        .global-results {
          background-color: #eff6ff;
          padding: 10px 15px;
          border: 2px solid #3b82f6;
          border-radius: 8px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .global-score {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0;
          gap: 15px;
        }
        .global-score-left {
          flex: 1;
        }
        .global-score-label {
          font-size: 10pt;
          color: #374151;
          font-weight: bold;
          margin-bottom: 2px;
        }
        .global-score-number {
          font-size: 32pt;
          font-weight: bold;
          color: #1e40af;
          line-height: 1;
          margin-bottom: 1px;
        }
        .global-score-detail {
          font-size: 9pt;
          color: #6b7280;
          margin-top: 0;
        }
        .percentile-bar {
          padding: 10px;
          background-color: #fff;
          border: 1px solid #d1d5db;
          border-radius: 4px;
        }
        .percentile-label {
          font-size: 11pt;
          margin-bottom: 8px;
          font-weight: bold;
        }
        .percentile-scale {
          display: flex;
          justify-content: space-between;
          font-size: 9pt;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .percentile-line {
          height: 8px;
          background: linear-gradient(to right, #e5e7eb 0%, #d1d5db 50%, #e5e7eb 100%);
          position: relative;
          border: 1px solid #9ca3af;
        }
        .percentile-marker {
          position: absolute;
          top: -4px;
          width: 0;
          height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 12px solid #000;
          transform: translateX(-8px);
        }
        .subject-results {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .subject-results h2 {
          font-size: 16pt;
          font-weight: bold;
          color: #1e40af;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 8px;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 10pt;
        }
        table th {
          background-color: #1e40af;
          color: #000;
          padding: 10px 8px;
          text-align: center;
          font-weight: bold;
          border-top: 1px solid #1e3a8a;
          border-bottom: 1px solid #1e3a8a;
          border-left: none;
          border-right: none;
        }
        table th:nth-child(2),
        table th:nth-child(3),
        table th:nth-child(4) {
          font-weight: normal;
          color: #000;
        }
        table td {
          padding: 10px 8px;
          border-top: 1px solid #d1d5db;
          border-bottom: 1px solid #d1d5db;
          border-left: none;
          border-right: none;
          vertical-align: middle;
        }
        table tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .subject-name {
          font-weight: bold;
          color: #1e40af;
          text-align: center;
        }
        .score-value {
          font-size: 11pt;
          font-weight: normal;
          color: #000;
        }
        .score-detail {
          font-size: 9pt;
          color: #6b7280;
        }
        .charts-container {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 20px;
          margin-bottom: 30px;
          page-break-inside: avoid;
          align-items: start;
        }
        .metrics-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          flex: 1;
        }
        .metric-card {
          background-color: #fff;
          border: 1px solid #3b82f6;
          border-radius: 6px;
          padding: 8px;
          position: relative;
          min-width: 0;
        }
        .metric-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
          gap: 4px;
        }
        .metric-card-title {
          font-size: 7pt;
          font-weight: bold;
          color: #374151;
          line-height: 1.2;
          flex: 1;
        }
        .metric-card-icon {
          font-size: 14pt;
          flex-shrink: 0;
        }
        .metric-card-value {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 4px;
          line-height: 1;
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
        .metric-card-detail {
          background-color: #f3f4f6;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 6pt;
          border: 1px solid #d1d5db;
          line-height: 1.2;
          word-wrap: break-word;
          color: #6b7280;
        }
        .chart-box {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 15px;
          background-color: #fff;
        }
        .chart-box.evolution-box {
          background-color: #2d2d2d !important;
          border: 0.5px solid #404040;
          border-radius: 4px;
          padding: 8px 0 0 0;
          margin: 0;
          width: 100%;
          overflow: hidden;
        }
        .chart-box.evolution-box .chart-title,
        .chart-box.evolution-box .chart-subtitle {
          padding: 0 8px;
          background-color: #2d2d2d;
          margin: 0;
        }
        .chart-box.evolution-box .chart-content {
          background-color: #2d2d2d !important;
          width: 100%;
          margin: 0;
          padding: 0;
          display: block;
          justify-content: stretch;
          align-items: stretch;
        }
        .chart-box.evolution-box .chart-content svg {
          display: block;
          width: 100%;
          height: auto;
          background-color: #2d2d2d !important;
          margin: 0;
          padding: 0;
        }
        .chart-box.evolution-box .chart-title {
          font-size: 10pt;
          font-weight: bold;
          color: #e5e7eb;
          margin-bottom: 4px;
          text-align: center;
        }
        .chart-box.evolution-box .chart-subtitle {
          font-size: 8pt;
          color: #9ca3af;
          margin-bottom: 8px;
          text-align: center;
        }
        .chart-title {
          font-size: 12pt;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 10px;
          text-align: center;
        }
        .chart-subtitle {
          font-size: 9pt;
          color: #6b7280;
          margin-bottom: 15px;
          text-align: center;
        }
        .chart-content {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section h2 {
          font-size: 16pt;
          font-weight: bold;
          color: #1e40af;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .section h3 {
          font-size: 14pt;
          font-weight: bold;
          color: #3b82f6;
          margin-top: 20px;
          margin-bottom: 10px;
        }
        .section p {
          text-align: justify;
          margin-bottom: 15px;
          font-size: 11pt;
        }
        ul, ol {
          margin-left: 25px;
          margin-bottom: 15px;
        }
        li {
          margin-bottom: 8px;
          font-size: 11pt;
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
          font-size: 10pt;
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
          <p><strong>Fase III - Simulacro ICFES</strong></p>
          <p><strong>Fecha de publicación de resultados:</strong> ${currentDate.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }).toUpperCase()}</p>
          <p><strong>Apellidos y nombres:</strong> ${studentName.toUpperCase()}</p>
          <p><strong>Institución educativa:</strong> ${institutionName || 'No especificada'}</p>
          ${(() => {
            const grado = summary.contextoAcademico?.grado;
            const isTechnicalId = grado && /^[a-zA-Z0-9]+-\d+-\d+$/.test(grado);
            return grado && !isTechnicalId ? `<p><strong>Grado:</strong> ${grado}</p>` : '';
          })()}
        </div>

        <!-- Resultado Final del Simulacro ICFES -->
        <div class="global-results">
          <div class="global-score">
            <div class="global-score-left">
              <div class="global-score-label">RESULTADO FINAL DEL SIMULACRO ICFES</div>
              <div class="global-score-number">${globalScore}</div>
              <div class="global-score-detail">De 500 puntos posibles, su puntaje global es ${globalScore}</div>
            </div>
            ${studentRank !== null && totalStudents !== null ? (() => {
              const currentRank = studentRank as number;
              const rankStyle = getRankTrophyAndColors(currentRank);
              return `
            <div style="flex: 0.8; margin-left: 15px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: ${rankStyle.bgGradient}; border-radius: 12px; padding: 8px 16px; border: 2px solid ${rankStyle.borderColor}; transform: scale(0.8); transform-origin: center;">
              <div style="font-size: 26pt; margin-bottom: 6px;">${rankStyle.trophy}</div>
              <div style="font-weight: bold; font-size: 14pt; color: ${rankStyle.textColor}; margin-bottom: 3px;">Puesto ${currentRank}</div>
              <div style="font-size: 8pt; color: ${rankStyle.detailColor}; text-align: center;">de ${totalStudents} estudiantes de su grado</div>
            </div>
            `;
            })() : ''}
          </div>
        </div>

        <!-- Gráfica de Evolución por Materia -->
        ${evolutionSVG ? `
        <div class="chart-box evolution-box" style="margin: 0; width: 100%; background-color: #2d2d2d !important; padding: 8px 0 0 0;">
          <div class="chart-title" style="color: #e5e7eb; padding: 0 8px; margin: 0;">Evolución por Materia</div>
          <div class="chart-subtitle" style="color: #9ca3af; padding: 0 8px; margin: 0 0 4px 0;">7 materias evaluadas</div>
          <div class="chart-content" style="background-color: #2d2d2d !important; width: 100%; margin: 0; padding: 0;">
            ${evolutionSVG}
          </div>
        </div>
        ` : ''}

        <!-- Resultados por Prueba -->
        <div class="subject-results">
          <h2>RESULTADOS POR PRUEBA</h2>
          <table>
            <thead>
              <tr>
                <th>PRUEBA</th>
                <th>PUNTAJE</th>
                <th>POSICIÓN EN EL GRUPO</th>
                <th>NIVELES DE DESEMPEÑO</th>
              </tr>
            </thead>
            <tbody>
              ${sortedSubjects.map((subj: any) => {
                const hasPosition = subj.position !== null && subj.totalStudentsInSubject !== null;
                const positionText = hasPosition 
                  ? `Ranking: ${subj.position} / ${subj.totalStudentsInSubject}` 
                  : 'Ranking: N/A';
                const performanceLevel = getPerformanceLevel(subj.percentage);
                return `
                <tr>
                  <td class="subject-name" style="text-align: center; vertical-align: middle;">${subj.name}</td>
                  <td style="text-align: center; vertical-align: middle;">
                    <div class="score-value">${subj.score}/100</div>
                  </td>
                  <td style="text-align: center; vertical-align: middle;">
                    <div style="font-size: 10pt; font-weight: normal; text-align: center; display: flex; align-items: center; justify-content: center; height: 100%;">
                      ${positionText}
                    </div>
                  </td>
                  <td style="text-align: center; vertical-align: middle;">
                    <div style="font-size: 9pt; font-weight: normal; text-align: center;">
                      <div style="font-weight: bold; margin-bottom: 3px;">${performanceLevel.level}</div>
                      <div style="font-size: 8pt; color: #4b5563;">${performanceLevel.definition}</div>
                    </div>
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Salto de página -->
        <div class="page-break"></div>

        <!-- Resumen General -->
        <div class="section">
          <h2>Resumen General</h2>
          <p>${summary.resumen.resumen_general}</p>
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

        <!-- Metadatos -->
        <div class="metadata">
          <p><strong>Información del reporte:</strong></p>
          <p>Materias analizadas: ${summary.metadata.materiasAnalizadas} de 7</p>
          <p>Modelo de IA: ${summary.metadata.modeloIA}</p>
          <p>Versión: ${summary.version}</p>
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
