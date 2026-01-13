# Comandos para Generar Palabras de Vocabulario

Este documento contiene los comandos PowerShell para generar palabras de vocabulario académico usando el endpoint HTTP desplegado.

## Comando Base

```powershell
# Comando genérico para generar palabras
$words = @('palabra1', 'palabra2', 'palabra3'); 
$body = @{ materia = 'NOMBRE_MATERIA'; palabras = $words } | ConvertTo-Json; 
$response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; 
Write-Host "Resultado:" -ForegroundColor Green; 
Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; 
Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; 
if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

## Comandos por Materia

### Lectura Crítica

```powershell
$words = @('inferencia', 'deducción', 'inducción', 'argumento', 'tesis', 'hipótesis', 'premisa', 'conclusión', 'síntesis', 'análisis', 'interpretación', 'comprensión', 'paráfrasis', 'resumen', 'crítica', 'evaluación', 'juicio', 'razonamiento', 'lógica', 'coherencia', 'cohesión', 'conectores', 'metáfora', 'símil', 'analogía', 'símbolo', 'alegoría', 'ironía', 'sarcasmo', 'paradoja', 'hipérbole', 'personificación', 'narrativa', 'descriptiva', 'expositiva', 'argumentativa', 'persuasiva', 'género', 'subgénero', 'tema', 'tópico', 'tópico oracional', 'estructura', 'párrafo', 'oración', 'enunciado', 'proposición', 'discurso', 'texto', 'contexto'); $body = @{ materia = 'lectura_critica'; palabras = $words } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

### Matemáticas

```powershell
$words = @('álgebra', 'ecuación', 'función', 'derivada', 'integral', 'límite', 'variable', 'constante', 'polinomio', 'factorización', 'raíz', 'exponente', 'logaritmo', 'trigonometría', 'seno', 'coseno', 'tangente', 'geometría', 'ángulo', 'perímetro', 'área', 'volumen', 'teorema', 'postulado', 'axioma', 'proporción', 'razón', 'porcentaje', 'probabilidad', 'estadística', 'media', 'mediana', 'moda', 'desviación', 'muestra', 'población', 'correlación', 'regresión', 'distribución', 'combinatoria', 'permutación', 'combinación', 'sucesión', 'progresión', 'aritmética', 'geométrica'); $body = @{ materia = 'matematicas'; palabras = $words } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

### Física

```powershell
$words = @('fuerza', 'masa', 'aceleración', 'velocidad', 'movimiento', 'inercia', 'momentum', 'energía', 'trabajo', 'potencia', 'fricción', 'rozamiento', 'gravedad', 'peso', 'newton', 'joule', 'ondas', 'frecuencia', 'amplitud', 'longitud de onda', 'período', 'reflexión', 'refracción', 'difracción', 'interferencia', 'resonancia', 'sonido', 'luz', 'óptica', 'lente', 'espejo', 'imagen', 'real', 'virtual', 'campo', 'eléctrico', 'magnético', 'carga', 'corriente', 'voltaje', 'resistencia', 'circuito', 'ley de ohm', 'termodinámica', 'temperatura', 'calor', 'entropía', 'energía interna', 'presión', 'volumen', 'gas ideal', 'leyes de newton'); $body = @{ materia = 'fisica'; palabras = $words } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

### Biología

```powershell
$words = @('célula', 'organelo', 'núcleo', 'mitocondria', 'ribosoma', 'membrana', 'citoplasma', 'ADN', 'ARN', 'gen', 'genoma', 'cromosoma', 'mitosis', 'meiosis', 'replicación', 'transcripción', 'traducción', 'proteína', 'enzima', 'metabolismo', 'fotosíntesis', 'respiración', 'celular', 'organismo', 'especie', 'género', 'familia', 'orden', 'clase', 'filo', 'reino', 'taxonomía', 'evolución', 'selección natural', 'adaptación', 'mutación', 'variación', 'ecosistema', 'biodiversidad', 'cadena alimentaria', 'red trófica', 'bioma', 'hábitat', 'nicho', 'población', 'comunidad', 'biósfera', 'homeostasis', 'sistema', 'órgano', 'tejido', 'sistema nervioso', 'sistema circulatorio', 'sistema digestivo', 'sistema respiratorio', 'sistema endocrino'); $body = @{ materia = 'biologia'; palabras = $words } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

### Química

```powershell
$words = @('átomo', 'molécula', 'elemento', 'compuesto', 'sustancia', 'mezcla', 'homogénea', 'heterogénea', 'enlace', 'covalente', 'iónico', 'metálico', 'valencia', 'electronegatividad', 'periodicidad', 'tabla periódica', 'grupo', 'período', 'metal', 'no metal', 'metaloides', 'reacción', 'ecuación química', 'balanceo', 'estequiometría', 'mol', 'masa molar', 'concentración', 'solución', 'soluto', 'solvente', 'ácido', 'base', 'pH', 'neutralización', 'oxidación', 'reducción', 'agente oxidante', 'agente reductor', 'equilibrio', 'cinética', 'catalizador', 'energía de activación', 'termoquímica', 'entalpía', 'entropía', 'energía libre', 'orgánica', 'inorgánica', 'hidrocarburo', 'alcano', 'alqueno', 'alquino', 'alcohol', 'ácido carboxílico', 'éster', 'polímero', 'monómero'); $body = @{ materia = 'quimica'; palabras = $words } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

### Inglés

```powershell
$words = @('vocabulary', 'grammar', 'syntax', 'semantics', 'phonetics', 'pronunciation', 'accent', 'intonation', 'stress', 'syllable', 'verb', 'noun', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'article', 'tense', 'present', 'past', 'future', 'perfect', 'continuous', 'passive', 'active', 'voice', 'mood', 'conditional', 'subjunctive', 'infinitive', 'gerund', 'participle', 'clause', 'phrase', 'sentence', 'paragraph', 'essay', 'composition', 'reading comprehension', 'listening', 'speaking', 'writing', 'fluency', 'accuracy', 'coherence', 'cohesion', 'register', 'formal', 'informal', 'idiom', 'phrasal verb', 'collocation', 'synonym', 'antonym', 'homonym', 'prefix', 'suffix', 'root', 'etymology', 'context', 'inference', 'main idea', 'supporting details', 'topic sentence', 'conclusion'); $body = @{ materia = 'ingles'; palabras = $words } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

### Sociales y Ciudadanas

```powershell
$words = @('democracia', 'ciudadanía', 'derechos', 'deberes', 'constitución', 'ley', 'norma', 'jurídico', 'estado', 'gobierno', 'poder', 'ejecutivo', 'legislativo', 'judicial', 'división de poderes', 'soberanía', 'territorio', 'nación', 'patria', 'identidad', 'cultura', 'tradición', 'costumbre', 'sociedad', 'comunidad', 'individuo', 'colectivo', 'organización', 'institución', 'sector', 'público', 'privado', 'economía', 'mercado', 'oferta', 'demanda', 'precio', 'valor', 'producción', 'consumo', 'distribución', 'comercio', 'exportación', 'importación', 'desarrollo', 'subdesarrollo', 'globalización', 'regionalización', 'integración', 'cooperación', 'conflicto', 'negociación', 'diplomacia', 'geografía', 'población', 'migración', 'urbanización', 'rural', 'ambiente', 'recursos naturales', 'sostenibilidad', 'conservación', 'contaminación', 'historia', 'historiografía', 'fuente', 'documento', 'archivo', 'cronología', 'periodización', 'causa', 'consecuencia', 'proceso', 'cambio', 'continuidad', 'revolución', 'reforma', 'independencia'); $body = @{ materia = 'sociales_ciudadanas'; palabras = $words } | ConvertTo-Json; $response = Invoke-RestMethod -Uri 'https://us-central1-superate-ia.cloudfunctions.net/generateVocabularyBatch' -Method Post -Body $body -ContentType 'application/json'; Write-Host "Resultado:" -ForegroundColor Green; Write-Host "  Exitosas: $($response.data.success)" -ForegroundColor Cyan; Write-Host "  Fallidas: $($response.data.failed)" -ForegroundColor Yellow; if ($response.data.failed -gt 0) { Write-Host "`nPalabras que fallaron:" -ForegroundColor Red; $response.data.failedWords | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow } }
```

## Cómo Usar

1. Abre PowerShell
2. Copia el comando completo de la materia que necesitas
3. Pégalo en PowerShell y presiona Enter
4. Espera a que se complete la generación (puede tardar varios minutos dependiendo de la cantidad de palabras)

## Notas

- Los comandos generan todas las palabras de una vez usando el endpoint HTTP
- Las palabras que ya existen en la base de datos se omiten automáticamente
- El sistema muestra cuántas palabras se generaron exitosamente y cuántas fallaron
- Si alguna palabra falla, se mostrará en la lista de "Palabras que fallaron"

## Nombres de Materias (normalizados)

- `matematicas` - Matemáticas
- `lectura_critica` - Lectura Crítica
- `fisica` - Física
- `biologia` - Biología
- `quimica` - Química
- `ingles` - Inglés
- `sociales_ciudadanas` - Sociales y Ciudadanas
