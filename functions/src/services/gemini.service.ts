/**
 * Servicio de Gemini AI para Backend
 * 
 * Maneja toda la lógica de generación de contenido con IA
 * Incluye construcción de prompts optimizados y validación de respuestas
 */

import { geminiClient, GEMINI_CONFIG } from '../config/gemini.config';
import {
  QuestionGenerationData,
  AIJustification,
  JustificationGenerationResult,
  QuestionOption,
  JustificationValidation,
  Question,
} from '../types/question.types';

/**
 * Servicio principal de Gemini para el backend
 */
class GeminiService {
  /**
   * Genera una justificación completa para una pregunta
   */
  async generateQuestionJustification(
    data: QuestionGenerationData
  ): Promise<JustificationGenerationResult> {
    const startTime = Date.now();
    
    try {
      if (!(await geminiClient.isAvailable())) {
        throw new Error('Servicio de Gemini no está disponible');
      }
      
      // Encontrar la opción correcta
      const correctOption = data.options.find(opt => opt.isCorrect);
      if (!correctOption) {
        throw new Error('No se encontró la opción correcta');
      }
      
      // Opciones incorrectas
      const incorrectOptions = data.options.filter(opt => !opt.isCorrect);
      
      // Construir el contenido multimodal (texto + imágenes)
      const multimodalContent = await this.buildMultimodalContent(data, correctOption, incorrectOptions);
      
      // Estrategia de generación con fallback: intentar con imágenes primero, luego sin imágenes si falla
      let result: { text: string; metadata: any };
      let usedImages = true;
      let fallbackReason: string | null = null;
      
      try {
        // Intentar primero con imágenes si las hay
        if (multimodalContent.images.length > 0) {
          console.log(`📷 Intentando generación CON ${multimodalContent.images.length} imagen(es)...`);
          result = await geminiClient.generateContent(multimodalContent.text, multimodalContent.images);
        } else {
          // No hay imágenes, generar solo con texto
          result = await geminiClient.generateContent(multimodalContent.text, []);
          usedImages = false;
        }
      } catch (error: any) {
        // Si falla con imágenes, intentar sin imágenes como fallback
        if (multimodalContent.images.length > 0) {
          const errorMessage = error.message || '';
          const isSafetyError = errorMessage.includes('bloqueada') || 
                               errorMessage.includes('SAFETY') || 
                               errorMessage.includes('filtros de seguridad') ||
                               errorMessage.includes('no tiene partes válidas');
          
          if (isSafetyError) {
            console.warn(`\n⚠️ Error con imágenes detectado (posible bloqueo de seguridad). Intentando SIN imágenes como fallback...`);
            console.warn(`   Error original: ${errorMessage.substring(0, 200)}`);
            fallbackReason = `Bloqueo de seguridad con imágenes: ${errorMessage.substring(0, 100)}`;
            
            try {
              // Intentar sin imágenes
              result = await geminiClient.generateContent(multimodalContent.text, []);
              usedImages = false;
              console.log(`✅ Fallback exitoso: Generación completada SIN imágenes`);
            } catch (fallbackError: any) {
              // Si también falla sin imágenes, lanzar el error original
              console.error(`❌ Fallback también falló. Error original: ${errorMessage}`);
              throw error; // Lanzar el error original
            }
          } else {
            // No es un error de seguridad, lanzar el error original
            throw error;
          }
        } else {
          // No hay imágenes, lanzar el error directamente
          throw error;
        }
      }
      
      // Extraer y parsear JSON con mejor manejo de errores
      let parsed: any;
      try {
        // Limpiar la respuesta: eliminar bloques de código markdown
        let cleanedText = result.text.replace(/```json\n?([\s\S]*?)\n?```/g, '$1');
        cleanedText = cleanedText.replace(/```\n?([\s\S]*?)\n?```/g, '$1');
        
        // Buscar el JSON: desde la primera llave hasta la última
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
          // Detectar si la respuesta parece ser código codificado o no es texto válido
          const looksLikeEncoded = /^[A-Za-z0-9+/=]+$/.test(cleanedText.trim().substring(0, 100));
          if (looksLikeEncoded) {
            throw new Error('La respuesta de Gemini parece ser código codificado (base64) en lugar de JSON. Es posible que la respuesta se haya corrompido o truncado.');
          }
          throw new Error('No se encontró estructura JSON válida en la respuesta. La respuesta puede estar truncada o no ser JSON válido.');
        }
        
        let jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
        
        // Detectar y completar estructuras incompletas antes de limpiar
        const openBrackets = (jsonString.match(/\[/g) || []).length;
        const closeBrackets = (jsonString.match(/\]/g) || []).length;
        const openBraces = (jsonString.match(/\{/g) || []).length;
        const closeBraces = (jsonString.match(/\}/g) || []).length;
        
        // Si hay más corchetes abiertos que cerrados, cerrar los arrays
        if (openBrackets > closeBrackets) {
          const missingBrackets = openBrackets - closeBrackets;
          jsonString += ']'.repeat(missingBrackets);
          console.log(`⚠️ Completando ${missingBrackets} corchete(s) de array faltante(s)`);
        }
        
        // Si hay más llaves abiertas que cerradas, cerrar los objetos
        if (openBraces > closeBraces) {
          const missingBraces = openBraces - closeBraces;
          jsonString += '}'.repeat(missingBraces);
          console.log(`⚠️ Completando ${missingBraces} llave(s) de objeto faltante(s)`);
        }
        
        // Detectar si incorrectAnswersExplanation está incompleto
        const incorrectArrayMatch = jsonString.match(/"incorrectAnswersExplanation"\s*:\s*\[([^\]]*)/);
        if (incorrectArrayMatch) {
          const arrayContent = incorrectArrayMatch[1].trim();
          // Si el array está vacío, incompleto o mal formado, completarlo
          if (!arrayContent || arrayContent === '' || (!arrayContent.includes('{') && !arrayContent.includes('"'))) {
            console.log('⚠️ Array incorrectAnswersExplanation incompleto. Completando con estructura mínima...');
            
            // Extraer las opciones incorrectas de los datos originales
            const incorrectOptions = data.options.filter(opt => !opt.isCorrect);
            const minArray = incorrectOptions.map(opt => ({
              optionId: opt.id,
              explanation: `La opción ${opt.id} es incorrecta porque no corresponde a la respuesta correcta.`
            }));
            
            // Reemplazar el array incompleto con uno válido
            jsonString = jsonString.replace(
              /"incorrectAnswersExplanation"\s*:\s*\[[^\]]*/,
              `"incorrectAnswersExplanation": ${JSON.stringify(minArray)}`
            );
          }
        }
        
        // Limpieza básica
        jsonString = jsonString
          .replace(/([{,]\s*)'(\w+)'\s*:/g, '$1"$2":') // Comillas simples en propiedades
          .replace(/:\s*'([^']*)'/g, ': "$1"') // Comillas simples en valores
          .replace(/,(\s*[}\]])/g, '$1'); // Trailing commas
        
        // Intentar parsear
        parsed = JSON.parse(jsonString);
      } catch (parseError: any) {
        // Si falla, intentar estrategia más agresiva
        console.warn('⚠️ Falló el parsing JSON inicial. Intentando limpieza agresiva...');
        
        try {
          let cleanedText = result.text
            .replace(/```json\n?([\s\S]*?)\n?```/g, '$1')
            .replace(/```\n?([\s\S]*?)\n?```/g, '$1');
          
          const firstBrace = cleanedText.indexOf('{');
          let lastBrace = cleanedText.lastIndexOf('}');
          
          // Si no hay llave de cierre, intentar completar el JSON
          if (lastBrace === -1 || lastBrace <= firstBrace) {
            // Buscar el último carácter válido y cerrar el JSON
            const lastQuote = cleanedText.lastIndexOf('"');
            if (lastQuote > firstBrace) {
              // Cerrar el string y el objeto
              cleanedText = cleanedText.substring(0, lastQuote + 1) + '}';
              lastBrace = cleanedText.length - 1;
            } else {
              throw new Error('JSON parece estar truncado y no se puede completar');
            }
          }
          
          let jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
          
          // Detectar y completar estructuras incompletas
          const openBrackets = (jsonString.match(/\[/g) || []).length;
          const closeBrackets = (jsonString.match(/\]/g) || []).length;
          const openBraces = (jsonString.match(/\{/g) || []).length;
          const closeBraces = (jsonString.match(/\}/g) || []).length;
          
          // Si hay más corchetes abiertos que cerrados, cerrar los arrays
          if (openBrackets > closeBrackets) {
            const missingBrackets = openBrackets - closeBrackets;
            jsonString += ']'.repeat(missingBrackets);
            console.log(`⚠️ Completando ${missingBrackets} corchete(s) de array faltante(s)`);
          }
          
          // Si hay más llaves abiertas que cerradas, cerrar los objetos
          if (openBraces > closeBraces) {
            const missingBraces = openBraces - closeBraces;
            jsonString += '}'.repeat(missingBraces);
            console.log(`⚠️ Completando ${missingBraces} llave(s) de objeto faltante(s)`);
          }
          
          // Detectar si incorrectAnswersExplanation está incompleto
          const incorrectArrayMatch = jsonString.match(/"incorrectAnswersExplanation"\s*:\s*\[([^\]]*)/);
          if (incorrectArrayMatch) {
            const arrayContent = incorrectArrayMatch[1].trim();
            // Si el array está vacío, incompleto o mal formado, completarlo
            if (!arrayContent || arrayContent === '' || (!arrayContent.includes('{') && !arrayContent.includes('"'))) {
              console.log('⚠️ Array incorrectAnswersExplanation incompleto. Completando con estructura mínima...');
              
              // Extraer las opciones incorrectas de los datos originales
              const incorrectOptions = data.options.filter(opt => !opt.isCorrect);
              const minArray = incorrectOptions.map(opt => ({
                optionId: opt.id,
                explanation: `La opción ${opt.id} es incorrecta porque no corresponde a la respuesta correcta.`
              }));
              
              // Reemplazar el array incompleto con uno válido
              jsonString = jsonString.replace(
                /"incorrectAnswersExplanation"\s*:\s*\[[^\]]*/,
                `"incorrectAnswersExplanation": ${JSON.stringify(minArray)}`
              );
            }
          }
          
          // Limpieza más agresiva
          jsonString = jsonString
            .replace(/([{,]\s*)'(\w+)'\s*:/g, '$1"$2":')
            .replace(/:\s*'([^']*)'/g, ': "$1"')
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/(\w+):/g, '"$1":') // Asegurar que las claves estén entre comillas
            .replace(/:\s*([^",\[\]{}]+)([,}\]])/g, ': "$1"$2'); // Asegurar que los valores estén entre comillas
          
          parsed = JSON.parse(jsonString);
          console.log('✅ JSON parseado con estrategia alternativa');
        } catch (secondError: any) {
          // Último intento: extraer solo los campos que necesitamos
          console.warn('⚠️ Falló el parsing agresivo. Intentando extracción parcial...');
          
          try {
            // Extraer correctAnswerExplanation
            const correctMatch = result.text.match(/"correctAnswerExplanation"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
            
            // Intentar extraer incorrectAnswersExplanation como array
            let incorrectAnswers: any[] = [];
            const incorrectArrayMatch = result.text.match(/"incorrectAnswersExplanation"\s*:\s*\[([^\]]*)/);
            
            if (incorrectArrayMatch) {
              // Intentar extraer objetos del array
              const arrayContent = incorrectArrayMatch[1];
              const optionMatches = arrayContent.match(/\{"optionId"\s*:\s*"([^"]+)"\s*,\s*"explanation"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/g);
              
              if (optionMatches && optionMatches.length > 0) {
                incorrectAnswers = optionMatches.map(match => {
                  const optionMatch = match.match(/"optionId"\s*:\s*"([^"]+)"\s*,\s*"explanation"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
                  if (optionMatch) {
                    return {
                      optionId: optionMatch[1],
                      explanation: optionMatch[2].replace(/\\"/g, '"')
                    };
                  }
                  return null;
                }).filter(item => item !== null) as any[];
              }
            }
            
            // Si no se pudo extraer el array o está vacío, crear uno mínimo
            if (incorrectAnswers.length === 0) {
              console.log('⚠️ No se pudo extraer incorrectAnswersExplanation. Creando estructura mínima...');
              const incorrectOptions = data.options.filter(opt => !opt.isCorrect);
              incorrectAnswers = incorrectOptions.map(opt => ({
                optionId: opt.id,
                explanation: `La opción ${opt.id} es incorrecta porque no corresponde a la respuesta correcta.`
              }));
            }
            
            if (correctMatch) {
              parsed = {
                correctAnswerExplanation: correctMatch[1].replace(/\\"/g, '"'),
                incorrectAnswersExplanation: incorrectAnswers,
                keyConcepts: [],
                perceivedDifficulty: data.level,
                confidence: 0.75,
              };
              console.log('✅ JSON parcial extraído exitosamente');
            } else {
              throw new Error('No se pudo extraer correctAnswerExplanation');
            }
          } catch (thirdError: any) {
            console.error('❌ Falló el parsing JSON incluso con extracción parcial.');
            console.error('   Texto original de Gemini:', result.text.substring(0, 2000));
            
            // Detectar si la respuesta parece ser código codificado
            const looksLikeEncoded = /^[A-Za-z0-9+/=]+$/.test(result.text.trim().substring(0, 100));
            const errorMessage = looksLikeEncoded 
              ? 'La respuesta de Gemini parece ser código codificado (base64) en lugar de JSON. Es posible que la respuesta se haya corrompido o truncado.'
              : `Error parseando JSON después de múltiples intentos: ${thirdError.message || 'Respuesta no es JSON válido'}`;
            
            throw new Error(`${errorMessage}. Primeros 500 caracteres: ${result.text.substring(0, 500)}...`);
          }
        }
      }
      
      // Validar estructura de respuesta
      if (!parsed.correctAnswerExplanation || !parsed.incorrectAnswersExplanation) {
        throw new Error('La respuesta de Gemini no tiene la estructura esperada');
      }
      
      // Construir la justificación
      const justification: AIJustification = {
        correctAnswerExplanation: parsed.correctAnswerExplanation,
        incorrectAnswersExplanation: parsed.incorrectAnswersExplanation,
        keyConcepts: parsed.keyConcepts || [],
        perceivedDifficulty: parsed.perceivedDifficulty || data.level,
        generatedAt: new Date(),
        generatedBy: GEMINI_CONFIG.MODEL_NAME,
        confidence: parsed.confidence || 0.85,
        promptVersion: GEMINI_CONFIG.PROMPT_VERSION,
      };
      
      // Agregar información sobre el fallback si se usó
      if (fallbackReason) {
        console.warn(`⚠️ Justificación generada con fallback (sin imágenes): ${fallbackReason}`);
        // Agregar nota en la justificación si el tipo lo permite
        if (justification.correctAnswerExplanation) {
          justification.correctAnswerExplanation = 
            `[Nota: Esta justificación se generó sin análisis visual de imágenes debido a restricciones de seguridad. ` +
            `La explicación se basa únicamente en el texto de la pregunta.]\n\n${justification.correctAnswerExplanation}`;
        }
      }
      
      // Log de confirmación
      if (multimodalContent.images.length > 0 && usedImages) {
        console.log(`✅ Justificación generada CON análisis visual de ${multimodalContent.images.length} imagen(es)`);
      } else if (multimodalContent.images.length > 0 && !usedImages) {
        console.warn(`⚠️ Justificación generada SIN imágenes (fallback aplicado)`);
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        questionId: data.questionId,
        justification,
        processingTimeMs: processingTime,
      };
    } catch (error: any) {
      console.error(`❌ Error generando justificación para ${data.questionCode}:`, error);
      
      return {
        success: false,
        questionId: data.questionId,
        error: error.message || 'Error desconocido',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Descarga una imagen desde una URL y la convierte a base64
   * Valida que la imagen sea accesible y tenga un tamaño razonable
   */
  private async downloadImageAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
    try {
      // Validar que la URL sea válida
      if (!url || typeof url !== 'string' || url.trim() === '') {
        console.error(`❌ URL de imagen inválida: ${url}`);
        return null;
      }

      console.log(`📥 Descargando imagen desde: ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SuperateIA/1.0)',
        },
        // Timeout de 30 segundos para descarga
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        console.error(`❌ Error HTTP descargando imagen ${url}: ${response.status} ${response.statusText}`);
        return null;
      }

      const contentType = response.headers.get('content-type');
      console.log(`   Content-Type recibido: ${contentType}`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Validar tamaño (máximo 20MB para base64, que es ~15MB de imagen)
      const maxSize = 20 * 1024 * 1024; // 20MB
      if (buffer.length > maxSize) {
        console.error(`❌ Imagen demasiado grande: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (máximo: ${maxSize / 1024 / 1024}MB)`);
        return null;
      }

      const base64 = buffer.toString('base64');
      
      // Validar que el base64 no esté vacío
      if (!base64 || base64.length === 0) {
        console.error(`❌ Error: base64 vacío después de conversión`);
        return null;
      }

      // Determinar el tipo MIME desde el Content-Type o la extensión de la URL
      let mimeType = contentType || 'image/jpeg';
      
      // Validar y normalizar el tipo MIME
      if (!mimeType.startsWith('image/')) {
        // Intentar inferir desde la URL
        const urlLower = url.toLowerCase();
        if (urlLower.includes('.png')) mimeType = 'image/png';
        else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) mimeType = 'image/jpeg';
        else if (urlLower.includes('.webp')) mimeType = 'image/webp';
        else if (urlLower.includes('.gif')) mimeType = 'image/gif';
        else {
          console.warn(`⚠️ Tipo MIME no reconocido (${contentType}), usando image/jpeg como default`);
          mimeType = 'image/jpeg'; // Default
        }
      }

      const sizeKB = (buffer.length / 1024).toFixed(2);
      const base64SizeKB = (base64.length / 1024).toFixed(2);
      console.log(`✅ Imagen descargada exitosamente:`);
      console.log(`   - Tamaño original: ${sizeKB} KB`);
      console.log(`   - Tamaño base64: ${base64SizeKB} KB`);
      console.log(`   - Tipo MIME: ${mimeType}`);
      console.log(`   - Base64 válido: ${base64.substring(0, 50)}... (${base64.length} caracteres)`);
      
      return { mimeType, data: base64 };
    } catch (error: any) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        console.error(`❌ Timeout descargando imagen ${url} (30s)`);
      } else {
        console.error(`❌ Error descargando imagen ${url}:`, error.message);
        console.error(`   Stack:`, error.stack);
      }
      return null;
    }
  }

  /**
   * Construye contenido multimodal (texto + imágenes) para Gemini
   * Ahora descarga las imágenes y las convierte a base64 para análisis visual real
   */
  private async buildMultimodalContent(
    data: QuestionGenerationData,
    correctOption: QuestionOption,
    incorrectOptions: QuestionOption[]
  ): Promise<{ text: string; images: Array<{ mimeType: string; data: string; context: string }> }> {
    console.log(`\n🔍 RECOPILANDO URLs DE IMÁGENES:`);
    
    // Recopilar todas las URLs de imágenes con su contexto
    const imageUrls: Array<{ url: string; context: string }> = [];
    
    // Imágenes informativas
    if (data.informativeImages && Array.isArray(data.informativeImages) && data.informativeImages.length > 0) {
      console.log(`   📷 Imágenes informativas encontradas: ${data.informativeImages.length}`);
      data.informativeImages.forEach((url, index) => {
        if (url && typeof url === 'string' && url.trim() !== '') {
          imageUrls.push({ 
            url: url.trim(), 
            context: `Imagen informativa ${index + 1} (contexto de la pregunta)` 
          });
          console.log(`      ✓ ${index + 1}. ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
        } else {
          console.warn(`      ⚠️ Imagen informativa ${index + 1} tiene URL inválida: ${url}`);
        }
      });
    } else {
      console.log(`   📷 Imágenes informativas: 0`);
    }
    
    // Imágenes en la pregunta
    if (data.questionImages && Array.isArray(data.questionImages) && data.questionImages.length > 0) {
      console.log(`   📷 Imágenes de pregunta encontradas: ${data.questionImages.length}`);
      data.questionImages.forEach((url, index) => {
        if (url && typeof url === 'string' && url.trim() !== '') {
          imageUrls.push({ 
            url: url.trim(), 
            context: `Imagen de la pregunta ${index + 1}` 
          });
          console.log(`      ✓ ${index + 1}. ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
        } else {
          console.warn(`      ⚠️ Imagen de pregunta ${index + 1} tiene URL inválida: ${url}`);
        }
      });
    } else {
      console.log(`   📷 Imágenes de pregunta: 0`);
    }
    
    // Imágenes en las opciones
    console.log(`   📷 Revisando imágenes en ${data.options.length} opciones...`);
    let optionImagesFound = 0;
    data.options.forEach((opt, optIndex) => {
      if (opt.imageUrl && typeof opt.imageUrl === 'string' && opt.imageUrl.trim() !== '') {
        optionImagesFound++;
        imageUrls.push({ 
          url: opt.imageUrl.trim(), 
          context: `Imagen de la opción ${opt.id || optIndex + 1}` 
        });
        console.log(`      ✓ Opción ${opt.id || optIndex + 1}: ${opt.imageUrl.substring(0, 80)}${opt.imageUrl.length > 80 ? '...' : ''}`);
      }
    });
    console.log(`   📷 Imágenes en opciones encontradas: ${optionImagesFound}`);
    
    console.log(`\n📊 RESUMEN DE RECOPILACIÓN:`);
    console.log(`   Total de URLs de imágenes encontradas: ${imageUrls.length}`);
    if (imageUrls.length > 0) {
      console.log(`   ✅ Las imágenes SERÁN descargadas y enviadas a Gemini\n`);
    } else {
      console.log(`   ℹ️ No hay imágenes - se enviará solo texto a Gemini\n`);
    }
    
    // Construir el prompt base
    const promptText = this.buildJustificationPrompt(
      data, 
      correctOption, 
      incorrectOptions, 
      imageUrls.length > 0,
      imageUrls
    );
    
    // Si no hay imágenes, devolver solo texto
    if (imageUrls.length === 0) {
      return { text: promptText, images: [] };
    }
    
    // Hay imágenes: descargarlas y convertirlas a base64
    console.log(`\n📷 ===== PROCESAMIENTO DE IMÁGENES =====`);
    console.log(`📷 Total de imágenes detectadas: ${imageUrls.length}`);
    imageUrls.forEach((img, idx) => {
      console.log(`   ${idx + 1}. ${img.context}`);
      console.log(`      URL: ${img.url}`);
    });
    console.log(`📷 Iniciando descarga y conversión a base64...\n`);
    
    const images: Array<{ mimeType: string; data: string; context: string }> = [];
    let downloadErrors = 0;
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      console.log(`\n[${i + 1}/${imageUrls.length}] Procesando: ${imageUrl.context}`);
      const imageData = await this.downloadImageAsBase64(imageUrl.url);
      if (imageData) {
        // Validar que el base64 no esté vacío antes de agregar
        if (imageData.data && imageData.data.length > 0) {
          images.push({
            mimeType: imageData.mimeType,
            data: imageData.data,
            context: imageUrl.context,
          });
          console.log(`✅ [${i + 1}/${imageUrls.length}] Imagen procesada exitosamente: ${imageUrl.context}`);
        } else {
          console.error(`❌ [${i + 1}/${imageUrls.length}] Base64 vacío para: ${imageUrl.context}`);
          downloadErrors++;
        }
      } else {
        console.error(`❌ [${i + 1}/${imageUrls.length}] FALLÓ descarga: ${imageUrl.context}`);
        console.error(`   URL: ${imageUrl.url}`);
        downloadErrors++;
      }
    }
    
    console.log(`\n📊 RESUMEN DE DESCARGAS:`);
    console.log(`   ✅ Exitosas: ${images.length}/${imageUrls.length}`);
    console.log(`   ❌ Fallidas: ${downloadErrors}/${imageUrls.length}`);
    
    // Validación adicional de imágenes antes de enviarlas
    if (images.length > 0) {
      console.log(`\n🔍 VALIDACIÓN FINAL DE IMÁGENES ANTES DE ENVIAR:`);
      let validImagesCount = 0;
      const imagesToSend: Array<{ mimeType: string; data: string; context: string }> = [];
      
      for (const img of images) {
        // Validar tamaño (máximo 20MB en base64)
        const base64SizeMB = img.data.length / 1024 / 1024;
        if (base64SizeMB > 20) {
          console.warn(`   ⚠️ Imagen ${img.context} demasiado grande (${base64SizeMB.toFixed(2)}MB) - OMITIENDO`);
          continue;
        }
        
        // Validar que el base64 sea válido
        try {
          Buffer.from(img.data, 'base64');
        } catch (e) {
          console.warn(`   ⚠️ Imagen ${img.context} tiene base64 inválido - OMITIENDO`);
          continue;
        }
        
        // Validar MIME type
        if (!img.mimeType || !img.mimeType.startsWith('image/')) {
          console.warn(`   ⚠️ Imagen ${img.context} tiene MIME type inválido (${img.mimeType}) - OMITIENDO`);
          continue;
        }
        
        validImagesCount++;
        imagesToSend.push(img);
        console.log(`   ✅ ${img.context}: Válida (${base64SizeMB.toFixed(2)}MB, ${img.mimeType})`);
      }
      
      if (validImagesCount === 0) {
        console.error(`\n❌ ERROR: Ninguna imagen pasó la validación final.`);
        console.error(`   Continuando con solo texto.\n`);
        return { text: promptText, images: [] };
      }
      
      if (validImagesCount < images.length) {
        console.warn(`\n⚠️ ADVERTENCIA: ${images.length - validImagesCount} imagen(es) fueron rechazadas en la validación final.`);
        console.warn(`   Solo ${validImagesCount} imagen(es) válida(s) serán enviadas a Gemini.\n`);
        return { text: promptText, images: imagesToSend };
      }
      
      console.log(`   ✅ Todas las ${validImagesCount} imagen(es) pasaron la validación\n`);
      return { text: promptText, images: imagesToSend };
    }
    
    if (images.length === 0) {
      console.error(`\n❌ ERROR CRÍTICO: No se pudieron descargar NINGUNA imagen.`);
      console.error(`   Esto significa que Gemini NO podrá analizar las imágenes visualmente.`);
      console.error(`   Continuando con solo texto, pero el análisis será limitado.\n`);
      return { text: promptText, images: [] };
    }
    
    if (downloadErrors > 0) {
      console.warn(`\n⚠️ ADVERTENCIA: ${downloadErrors} imagen(es) no se pudieron descargar.`);
      console.warn(`   Solo ${images.length} imagen(es) estarán disponibles para análisis visual.\n`);
    }
    
    // Calcular tamaño total de las imágenes en base64
    const totalBase64Size = images.reduce((sum, img) => sum + img.data.length, 0);
    const totalSizeKB = (totalBase64Size / 1024).toFixed(2);
    const totalSizeMB = (totalBase64Size / 1024 / 1024).toFixed(2);
    
    console.log(`✅ PREPARACIÓN COMPLETA:`);
    console.log(`   📷 Imágenes listas para envío: ${images.length}`);
    console.log(`   📦 Tamaño total base64: ${totalSizeKB} KB (${totalSizeMB} MB)`);
    console.log(`   🚀 Listas para análisis visual por Gemini\n`);
    
    // Agregar instrucciones mejoradas al prompt sobre las imágenes que se enviarán
    const enhancedPrompt = promptText + `\n\n═══════════════════════════════════════════════════════════════
🖼️ ANÁLISIS VISUAL REQUERIDO
═══════════════════════════════════════════════════════════════

Esta pregunta contiene ${images.length} imagen(es) que se incluyen en este mensaje como contenido visual.

**INSTRUCCIONES CRÍTICAS PARA EL ANÁLISIS:**
1. Analiza CADA imagen visualmente con atención detallada
2. Describe específicamente qué observas en cada imagen (elementos, texto, gráficos, diagramas, etc.)
3. Relaciona el contenido visual con la pregunta y las opciones de respuesta
4. Usa la información visual para fundamentar tus explicaciones de por qué cada opción es correcta o incorrecta
5. Si hay texto en las imágenes, léelo y úsalo en tu análisis
6. Si hay gráficos o diagramas, analiza su estructura y significado

Las imágenes están etiquetadas con su contexto. Asegúrate de referenciar cada imagen por su contexto en tus explicaciones.

═══════════════════════════════════════════════════════════════
`;
    
    return { text: enhancedPrompt, images };
  }

  /**
   * Construye el prompt optimizado para generar justificaciones
   * 
   * Este prompt está diseñado para obtener:
   * - Explicaciones claras y educativas
   * - Análisis profundo de conceptos
   * - Identificación de errores comunes
   * - Respuestas en formato JSON estructurado
   */
  private buildJustificationPrompt(
    data: QuestionGenerationData,
    correctOption: QuestionOption,
    incorrectOptions: QuestionOption[],
    hasImages: boolean = false,
    imageUrls: Array<{ url: string; context: string }> = []
  ): string {
    const contextInfo = data.informativeText
      ? `\n\n**CONTEXTO INFORMATIVO:**\n${data.informativeText}\n*Analiza este contexto cuidadosamente, es clave para entender la pregunta.*`
      : '';
    
    const imageGuidance = hasImages && imageUrls.length > 0
      ? `\n\n**🖼️ IMPORTANTE - ANÁLISIS VISUAL REQUERIDO:**
Esta pregunta contiene ${imageUrls.length} imagen(es). DEBES analizar cada imagen cuidadosamente:

${imageUrls.map((img, i) => `${i + 1}. **${img.context}**
   - Describe qué se muestra en la imagen
   - Identifica elementos clave (gráficos, diagramas, ecuaciones, mapas, etc.)
   - Explica cómo la información visual se relaciona con la pregunta
   - Usa la información visual para fundamentar tus explicaciones`).join('\n\n')}

**Tu análisis DEBE:**
✅ Hacer referencia específica a lo que ves en cada imagen
✅ Integrar la información visual en tus explicaciones
✅ Explicar cómo los elementos visuales apoyan o contradicen cada opción
✅ Ser específico sobre qué observar en las imágenes

❌ NO digas "según la imagen" sin especificar QUÉ hay en la imagen
❌ NO asumas que el estudiante ve lo mismo que tú sin guiarlo`
      : '';
    
    return `Eres el **Dr. Educativo**, un pedagogo experto con 20 años de experiencia en ${data.subject}, especializado en diseño de evaluaciones y análisis de aprendizaje. Tu misión es ayudar a estudiantes a comprender profundamente los conceptos y entender el porqué de las respuestas.

═══════════════════════════════════════════════════════════════
📋 INFORMACIÓN DE LA EVALUACIÓN
═══════════════════════════════════════════════════════════════

**Identificación:**
- Código de pregunta: ${data.questionCode}
- Materia: ${data.subject}
- Tema específico: ${data.topic}
- Nivel de dificultad: ${data.level}${contextInfo}${imageGuidance}

═══════════════════════════════════════════════════════════════
❓ PREGUNTA A ANALIZAR
═══════════════════════════════════════════════════════════════

${data.questionText}

═══════════════════════════════════════════════════════════════
📊 OPCIONES DE RESPUESTA
═══════════════════════════════════════════════════════════════

${data.options.map(opt => {
      const optionText = opt.text || (opt.imageUrl ? '🖼️ [VER IMAGEN DE LA OPCIÓN]' : '[Sin texto]');
      const marker = opt.isCorrect ? '✅ RESPUESTA CORRECTA' : '❌ RESPUESTA INCORRECTA';
      return `**Opción ${opt.id}:** ${optionText}\n${marker}`;
    }).join('\n\n')}

═══════════════════════════════════════════════════════════════
🎯 TU MISIÓN COMO EDUCADOR EXPERTO
═══════════════════════════════════════════════════════════════

Debes generar un **análisis pedagógico completo** que ayude al estudiante a:
1. Entender POR QUÉ la opción ${correctOption.id} es la correcta
2. Comprender QUÉ ERROR CONCEPTUAL hay en cada opción incorrecta
3. Identificar los CONCEPTOS CLAVE que debe dominar
4. Desarrollar el PENSAMIENTO CRÍTICO para preguntas similares

═══════════════════════════════════════════════════════════════
📋 ESTRUCTURA DE RESPUESTA (JSON)
═══════════════════════════════════════════════════════════════

Genera tu análisis en el siguiente formato JSON exacto:

{
  "correctAnswerExplanation": "AQUÍ tu explicación de la opción ${correctOption.id}",
  "incorrectAnswersExplanation": [
${incorrectOptions.map(opt => `    {
      "optionId": "${opt.id}",
      "explanation": "AQUÍ tu explicación de por qué ${opt.id} es incorrecta"
    }`).join(',\n')}
  ],
  "keyConcepts": [
    "Concepto clave 1",
    "Concepto clave 2",
    "Concepto clave 3"
  ],
  "perceivedDifficulty": "Fácil|Medio|Difícil",
  "confidence": 0.95
}

═══════════════════════════════════════════════════════════════
🎓 DIRECTRICES PEDAGÓGICAS AVANZADAS
═══════════════════════════════════════════════════════════════

### 1️⃣ EXPLICACIÓN DE LA RESPUESTA CORRECTA (Opción ${correctOption.id})

**Estructura recomendada (4-6 oraciones densas en contenido educativo):**

a) **Afirmación inicial**: "La opción ${correctOption.id} es correcta porque..."

b) **Razonamiento paso a paso**:
   - Paso 1: Identifica el concepto principal que se evalúa
   - Paso 2: Explica cómo ese concepto se aplica a esta pregunta específica
   - Paso 3: Conecta con el conocimiento teórico fundamental

c) **Fundamento teórico**: Referencia la ley, teorema, principio o concepto base

d) **Ejemplo o analogía** (si es apropiado): Usa algo familiar para el estudiante

e) **Cierre pedagógico**: Resalta qué habilidad o conocimiento demuestra esta respuesta

### 2️⃣ EXPLICACIÓN DE CADA RESPUESTA INCORRECTA

**Para CADA opción incorrecta (3-4 oraciones por opción):**

a) **Identificación del error**: "Esta opción es incorrecta porque..."

b) **Diagnóstico del misconception** (error conceptual):
   - ¿Qué malentendido específico llevó a esta opción?
   - ¿Es un error de cálculo, de concepto, de interpretación, o de aplicación?
   - ¿Por qué podría parecer correcta a primera vista?

c) **Explicación correctiva**: ¿Qué debería entender el estudiante para NO caer en este error?

d) **Pista pedagógica**: ¿Qué debe recordar o considerar para evitar este error en el futuro?

**Tono**: Constructivo y empático. No digas "es obvio" o "claramente está mal".

### 3️⃣ CONCEPTOS CLAVE (3-5 conceptos)

Identifica conceptos fundamentales (máximo 8 palabras cada uno).

**Ejemplos buenos:**
✅ "Propiedades de los ángulos en triángulos"
✅ "Ley de conservación de la energía"

**Ejemplos malos:**
❌ "Matemáticas" (demasiado general)

### 4️⃣ DIFICULTAD PERCIBIDA

**"Fácil"**: Aplicación directa de un concepto básico, sin pasos intermedios
**"Medio"**: Requiere combinar 2-3 conceptos, un paso de razonamiento lógico
**"Difícil"**: Síntesis de múltiples conceptos avanzados, pensamiento crítico

### 5️⃣ CONFIANZA (0.0 a 1.0)

**0.95-1.0**: Pregunta clara, respuesta inequívoca
**0.85-0.94**: Alta confianza, puede haber sutilezas
**0.70-0.84**: Confianza moderada-alta
**0.50-0.69**: Pregunta ambigua o contexto insuficiente

═══════════════════════════════════════════════════════════════
⚠️ RESTRICCIONES CRÍTICAS
═══════════════════════════════════════════════════════════════

🚫 **NO HAGAS:**
- No uses markdown (\`\`\`json)
- No agregues texto antes o después del JSON
- No uses lenguaje condescendiente ("obviamente", "claramente")
- No des explicaciones genéricas o circulares
- No excedas 8 oraciones por explicación
- Si hay imágenes, NO digas solo "según la imagen" sin especificar QUÉ hay en ella

✅ **SÍ HAZLO:**
- Responde SOLO con JSON válido
- Usa lenguaje natural y accesible para nivel
- **Para fórmulas matemáticas**: Usa formato LaTeX dentro de etiquetas \`$...$\` para fórmulas inline o \`$$...$$\` para fórmulas en bloque
  Ejemplo: "La expresión \`$P(t) = 2^{t+2} \cdot \frac{5}{8}t$\` representa..."
  Ejemplo: "Aplicando \`$\frac{a}{b} = c$\` obtenemos..." ${data.level}
- Sé específico y concreto en cada explicación
- Enfócate en el APRENDIZAJE, no solo en la respuesta
- Conecta con conocimientos previos del estudiante
- Usa ejemplos o analogías cuando ayuden
- Si hay imágenes, describe lo que ves y cómo se relaciona con la pregunta

═══════════════════════════════════════════════════════════════
🎯 CONSIDERACIONES ESPECIALES
═══════════════════════════════════════════════════════════════

- **Nivel del estudiante**: Ajusta el lenguaje y profundidad para ${data.level}
- **Materia**: Usa terminología precisa de ${data.subject}
- **Contexto cultural**: Usa ejemplos universales y accesibles
- **Engagement**: Haz que el estudiante QUIERA leer tu explicación
- **Análisis visual**: Si hay imágenes, integra la información visual en TODAS tus explicaciones

═══════════════════════════════════════════════════════════════

**Ahora genera el JSON con tu análisis pedagógico completo:**`;
  }

  /**
   * Genera justificaciones para múltiples preguntas (batch)
   */
  async generateBatchJustifications(
    questions: QuestionGenerationData[],
    onProgress?: (current: number, total: number, result: JustificationGenerationResult) => void
  ): Promise<JustificationGenerationResult[]> {
    const results: JustificationGenerationResult[] = [];
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      try {
        const result = await this.generateQuestionJustification(question);
        results.push(result);
        
        if (onProgress) {
          onProgress(i + 1, questions.length, result);
        }
        
        // Pequeña pausa entre requests para evitar rate limiting
        if (i < questions.length - 1) {
          await this.delay(1000); // 1 segundo entre requests
        }
      } catch (error: any) {
        console.error(`Error procesando pregunta ${question.questionCode}:`, error);
        results.push({
          success: false,
          questionId: question.questionId,
          error: error.message,
        });
      }
    }
    
    return results;
  }

  /**
   * Valida una justificación existente
   */
  async validateJustification(
    question: Question,
    justification: AIJustification
  ): Promise<JustificationValidation> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    
    // Validar que exista explicación de respuesta correcta
    if (!justification.correctAnswerExplanation || 
        justification.correctAnswerExplanation.length < 50) {
      issues.push('La explicación de la respuesta correcta es muy corta o inexistente');
    }
    
    // Validar explicaciones de respuestas incorrectas
    const incorrectOptions = question.options.filter(opt => !opt.isCorrect);
    if (justification.incorrectAnswersExplanation.length !== incorrectOptions.length) {
      issues.push('No hay explicaciones para todas las opciones incorrectas');
    }
    
    // Validar cada explicación incorrecta
    justification.incorrectAnswersExplanation.forEach(exp => {
      if (!exp.explanation || exp.explanation.length < 30) {
        issues.push(`La explicación de la opción ${exp.optionId} es muy corta`);
      }
    });
    
    // Validar conceptos clave
    if (!justification.keyConcepts || justification.keyConcepts.length < 2) {
      suggestions.push('Se recomienda añadir más conceptos clave (mínimo 2-3)');
    }
    
    // Validar confianza
    if (justification.confidence && justification.confidence < 0.7) {
      suggestions.push('La confianza es baja, considera regenerar la justificación');
    }
    
    // Validar que las explicaciones no sean genéricas
    const genericPhrases = ['es correcta', 'es incorrecta', 'no es válida'];
    let hasGenericContent = false;
    
    genericPhrases.forEach(phrase => {
      if (justification.correctAnswerExplanation.toLowerCase().includes(phrase) &&
          justification.correctAnswerExplanation.length < 100) {
        hasGenericContent = true;
      }
    });
    
    if (hasGenericContent) {
      suggestions.push('Las explicaciones parecen genéricas, considera regenerar para más profundidad');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Mejora una justificación existente
   */
  async improveJustification(
    question: Question,
    currentJustification: AIJustification
  ): Promise<JustificationGenerationResult> {
    const data: QuestionGenerationData = {
      questionId: question.id || '',
      questionCode: question.code,
      subject: question.subject,
      topic: question.topic,
      level: question.level,
      questionText: question.questionText,
      informativeText: question.informativeText,
      options: question.options,
    };
    
    // Validar primero
    const validation = await this.validateJustification(question, currentJustification);
    
    console.log(`🔍 Validación de justificación actual:`, validation);
    
    // Regenerar con el contexto de la justificación anterior
    return this.generateQuestionJustification(data);
  }

  /**
   * Utilidad: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene información del servicio
   */
  async getInfo() {
    return {
      available: await geminiClient.isAvailable(),
      clientInfo: geminiClient.getInfo(),
      config: {
        model: GEMINI_CONFIG.MODEL_NAME,
        promptVersion: GEMINI_CONFIG.PROMPT_VERSION,
        maxRequestsPerMinute: GEMINI_CONFIG.MAX_REQUESTS_PER_MINUTE,
      },
    };
  }
}

// Exportar instancia singleton
export const geminiService = new GeminiService();

export default geminiService;

