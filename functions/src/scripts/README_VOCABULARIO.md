# Script de Generación de Vocabulario Académico

Este script permite generar definiciones de vocabulario académico de forma masiva para poblar el banco de vocabulario antes de que los estudiantes lo necesiten, reduciendo la latencia en el dashboard.

## Uso

### Generar vocabulario para todas las materias

```bash
npm run generate-vocabulary
```

### Generar vocabulario para una materia específica

```bash
npm run generate-vocabulary -- --materia=matematicas
npm run generate-vocabulary -- --materia=lectura_critica
npm run generate-vocabulary -- --materia=fisica
npm run generate-vocabulary -- --materia=biologia
npm run generate-vocabulary -- --materia=quimica
npm run generate-vocabulary -- --materia=ingles
npm run generate-vocabulary -- --materia=sociales_ciudadanas
```

### Opciones disponibles

- `--materia=<nombre>`: Especifica la materia a procesar. Usa `all` para todas (por defecto).
- `--batch-size=<número>`: Número de palabras a procesar por lote (por defecto: 20).
- `--delay=<milisegundos>`: Delay entre lotes en milisegundos (por defecto: 3000).
- `--dry-run`: Modo de prueba que muestra lo que haría sin ejecutar realmente.
- `--no-skip-existing`: Procesa todas las palabras, incluso las que ya tienen definición.

### Ejemplos

```bash
# Generar vocabulario para matemáticas con lotes de 10 palabras
npm run generate-vocabulary -- --materia=matematicas --batch-size=10

# Modo dry-run para ver qué haría sin ejecutar
npm run generate-vocabulary -- --materia=lectura_critica --dry-run

# Generar todo el vocabulario con delay de 5 segundos entre lotes
npm run generate-vocabulary -- --delay=5000

# Regenerar definiciones existentes (útil para actualizar)
npm run generate-vocabulary -- --materia=all --no-skip-existing
```

## Palabras incluidas por materia

### Matemáticas (48 palabras)
Álgebra, ecuaciones, funciones, derivadas, integrales, geometría, trigonometría, estadística, probabilidad, etc.

### Lectura Crítica (42 palabras)
Inferencia, deducción, argumento, tesis, análisis, interpretación, figuras literarias, géneros textuales, etc.

### Física (45 palabras)
Fuerza, energía, movimiento, ondas, óptica, electricidad, magnetismo, termodinámica, etc.

### Biología (50 palabras)
Célula, ADN, genética, evolución, ecosistemas, taxonomía, sistemas del cuerpo, etc.

### Química (48 palabras)
Átomo, molécula, enlaces, reacciones, estequiometría, ácidos, bases, química orgánica, etc.

### Inglés (45 palabras)
Gramática, vocabulario, tiempos verbales, comprensión lectora, habilidades comunicativas, etc.

### Sociales y Ciudadanas (50 palabras)
Democracia, ciudadanía, derechos, gobierno, economía, geografía, historia, etc.

**Total: ~328 palabras académicas**

## Flujo de trabajo recomendado

1. **Primera ejecución (poblar banco inicial)**:
   ```bash
   npm run generate-vocabulary
   ```
   Esto generará todas las definiciones para todas las materias.

2. **Verificar progreso**:
   El script muestra estadísticas al final:
   - Total de palabras procesadas
   - Definiciones generadas exitosamente
   - Palabras omitidas (ya existían)
   - Fallos

3. **Actualizar definiciones existentes** (si es necesario):
   ```bash
   npm run generate-vocabulary -- --no-skip-existing
   ```

## Notas importantes

- El script respeta las palabras que ya tienen definición (por defecto) para evitar regenerar innecesariamente.
- Hay un delay de 3 segundos entre lotes para evitar rate limits de la API de Gemini.
- Las definiciones se guardan en Firestore en la colección `definitionswords/{materia}/palabras/{palabraId}`.
- Si una palabra falla, el script continúa con las siguientes y muestra un resumen al final.

## Troubleshooting

### Error: "Servicio de Gemini no está disponible"
- Verifica que las credenciales de Vertex AI estén configuradas correctamente.
- Revisa las variables de entorno en `.env` o en Firebase Functions.

### Error: "Rate limit exceeded"
- Aumenta el delay entre lotes: `--delay=5000`
- Reduce el tamaño del lote: `--batch-size=10`

### Algunas palabras fallan
- Esto es normal. El script continúa y muestra un resumen al final.
- Puedes ejecutar el script nuevamente solo para las palabras que fallaron.

## Integración con el sistema

Una vez generadas las definiciones, el componente `VocabularyBank` en el frontend las consultará automáticamente desde Firestore, sin necesidad de generar definiciones en tiempo real, mejorando significativamente la experiencia del usuario.
