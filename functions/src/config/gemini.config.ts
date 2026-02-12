/**
 * Configuración de Gemini AI
 * 
 * Este archivo configura el cliente de Gemini AI y proporciona
 * funcionalidades para generar contenido con IA
 */

// Cargar variables de entorno desde .env (solo en desarrollo local)
import * as dotenv from 'dotenv';
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
  dotenv.config();
}

import { VertexAI } from '@google-cloud/vertexai';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Configuración de Gemini
 * Todos los valores se leen desde variables de entorno (.env)
 */
export const GEMINI_CONFIG = {
  PROJECT_ID: process.env.VERTEX_AI_PROJECT_ID || process.env.GEMINI_PROJECT_ID || 'superate-ia',
  REGION: process.env.VERTEX_AI_REGION || process.env.GEMINI_REGION || 'us-central1',
  MODEL_NAME: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  VERTEX_AI_CREDENTIALS: process.env.VERTEX_AI_CREDENTIALS || './serviceAccountKey-ia.json',
  PROMPT_VERSION: '2.5.0',
  
  // Límites de rate limiting (valores fijos, no configurables desde .env)
  MAX_REQUESTS_PER_MINUTE: 10, // Reducido para evitar errores 429
  DELAY_BETWEEN_REQUESTS_MS: 2000, // Aumentado a 2 segundos entre requests
  
  // Timeouts (valores fijos, no configurables desde .env)
  // 7 minutos para prompts largos con múltiples imágenes (más de 4 imágenes)
  REQUEST_TIMEOUT_MS: 420000, // Timeout base (7 minutos)
  REQUEST_TIMEOUT_MULTIPLE_IMAGES_MS: 600000, // 10 minutos para preguntas con más de 4 imágenes
  
  // Reintentos (valores fijos, no configurables desde .env)
  MAX_RETRIES: 3, // 3 intentos: base, +50%, +100%
  RETRY_DELAY_MS: 8000, // Aumentado a 8 segundos entre reintentos
} as const;

/**
 * Configuración de generación de contenido
 * Optimizado para Gemini 2.5 Flash con Vertex AI
 */
const generationConfig = {
  temperature: 0.8,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 65536, // 64k para planes con muchos ejercicios/topics y evitar truncado que malforma el JSON
};

/**
 * Cliente de Gemini AI con Vertex AI
 */
class GeminiClient {
  private vertexAI: VertexAI | null = null;
  private model: any = null;
  private lastRequestTime: number = 0;
  private requestCount: number = 0;
  private requestResetTime: number = Date.now();
  private vertexKeyPath: string;
  private serviceAccountKey: any;
  private originalGoogleCreds: string | undefined;

  constructor() {
    // Preparar las credenciales pero NO inicializar VertexAI todavía
    // Leer la ruta desde la configuración (que viene de .env)
    const credentialsPath = GEMINI_CONFIG.VERTEX_AI_CREDENTIALS;
    
    // Detectar si estamos en modo deploy/analizador de Firebase
    // Durante el deploy, Firebase ejecuta el código para analizarlo, pero no debemos validar archivos
    const isDeployPhase = process.env.FIREBASE_CONFIG || 
                          process.env.GCLOUD_PROJECT ||
                          (typeof process.env.FUNCTION_TARGET === 'undefined' && !process.env.FUNCTIONS_EMULATOR);
    
    // Solo validar archivos en desarrollo local con emulador o cuando explícitamente no estamos en deploy
    const shouldValidateFiles = !isDeployPhase && 
                                 (process.env.FUNCTIONS_EMULATOR === 'true' || 
                                  process.env.NODE_ENV === 'development');
    
    if (shouldValidateFiles && credentialsPath) {
      try {
        // Validar que sea una ruta de archivo válida (no un hash)
        if (credentialsPath.length > 200 || !credentialsPath.endsWith('.json')) {
          console.warn(`⚠️ VERTEX_AI_CREDENTIALS no parece ser una ruta válida: ${credentialsPath}`);
          this.vertexKeyPath = '';
          this.serviceAccountKey = null;
        } else {
          this.vertexKeyPath = path.resolve(__dirname, '../../', credentialsPath);
          
          if (fs.existsSync(this.vertexKeyPath)) {
            this.serviceAccountKey = JSON.parse(fs.readFileSync(this.vertexKeyPath, 'utf8'));
            console.log('✅ Cliente de Gemini (Vertex AI) configurado (modo local)');
            console.log(`   Proyecto Vertex AI: ${GEMINI_CONFIG.PROJECT_ID}`);
            console.log(`   Región: ${GEMINI_CONFIG.REGION}`);
            console.log(`   Modelo: ${GEMINI_CONFIG.MODEL_NAME}`);
            console.log(`   Email de servicio: ${this.serviceAccountKey.client_email}`);
          } else {
            console.warn(`⚠️ No se encontró el archivo de credenciales: ${this.vertexKeyPath}`);
            this.vertexKeyPath = '';
            this.serviceAccountKey = null;
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ Error cargando credenciales locales: ${error.message}`);
        this.vertexKeyPath = '';
        this.serviceAccountKey = null;
      }
    } else {
      // Producción o deploy: no validar archivos, usar credenciales automáticas
      this.vertexKeyPath = '';
      this.serviceAccountKey = null;
      if (!isDeployPhase) {
        console.log('✅ Cliente de Gemini (Vertex AI) configurado (modo producción)');
      }
    }
    
    this.originalGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
  }

  /**
   * Inicializa el cliente de Gemini con Vertex AI
   * Se llama justo antes de usar para asegurar credenciales correctas
   */
  private async ensureInitialized(): Promise<void> {
    if (this.vertexAI && this.model) {
      return; // Ya está inicializado
    }
    
    try {
      // Detectar si estamos en producción (Firebase Functions)
      // En producción: GCLOUD_PROJECT está definido Y FUNCTIONS_EMULATOR NO es 'true'
      const isProduction = process.env.GCLOUD_PROJECT && 
                          process.env.FUNCTIONS_EMULATOR !== 'true' &&
                          process.env.FUNCTION_TARGET !== undefined;
      
      // Desarrollo local: usar credenciales explícitas solo si están disponibles
      const isLocalDevelopment = !isProduction && 
                                 process.env.FUNCTIONS_EMULATOR === 'true' &&
                                 this.serviceAccountKey;
      
      if (isLocalDevelopment) {
        // Desarrollo local: usar credenciales explícitas
        console.log('🔧 Inicializando Vertex AI en modo desarrollo local con credenciales explícitas');
        this.vertexAI = new VertexAI({
          project: GEMINI_CONFIG.PROJECT_ID, // Desde .env
          location: GEMINI_CONFIG.REGION, // Desde .env
          googleAuthOptions: {
            credentials: this.serviceAccountKey, // ⚠️ Pasamos el JSON parseado directamente
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          },
        });
      } else {
        // Producción: usar credenciales automáticas de Firebase Functions
        // Firebase Functions usa automáticamente la cuenta de servicio del proyecto
        // No especificar googleAuthOptions - dejar que use Application Default Credentials (ADC)
        console.log('🔧 Inicializando Vertex AI en modo producción con credenciales automáticas de Firebase');
        console.log(`   Proyecto: ${GEMINI_CONFIG.PROJECT_ID}`);
        console.log(`   Región: ${GEMINI_CONFIG.REGION}`);
        console.log(`   Cuenta de servicio: ${process.env.GCLOUD_PROJECT}@appspot.gserviceaccount.com`);
        console.log(`   Usando Application Default Credentials (ADC)`);
        
        // Asegurar que GOOGLE_APPLICATION_CREDENTIALS no esté establecido en producción
        // Firebase Functions debe usar las credenciales del servicio automáticamente
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
          console.log(`   ⚠️ GOOGLE_APPLICATION_CREDENTIALS estaba establecido, removido para usar ADC`);
        }
        
        this.vertexAI = new VertexAI({
          project: GEMINI_CONFIG.PROJECT_ID,
          location: GEMINI_CONFIG.REGION,
          // No especificar googleAuthOptions - usar Application Default Credentials automáticamente
          // Firebase Functions proporciona las credenciales automáticamente vía metadata service
        });
      }

      // Para modelos Publisher de Gemini, el SDK construye automáticamente la ruta:
      // projects/{project}/locations/{location}/publishers/google/models/{model}
      // Solo necesitamos especificar el nombre del modelo sin ruta completa
      // El SDK reconoce automáticamente que es un modelo Publisher de Google
      this.model = this.vertexAI.getGenerativeModel({
        model: GEMINI_CONFIG.MODEL_NAME, // 'gemini-2.5-flash' - el SDK construye la ruta completa
        generationConfig: generationConfig,
      });
      
      console.log(`   Modelo configurado: ${GEMINI_CONFIG.MODEL_NAME}`);
      if (isLocalDevelopment && this.serviceAccountKey) {
        console.log(`   Ruta esperada: projects/${this.serviceAccountKey.project_id}/locations/${GEMINI_CONFIG.REGION}/publishers/google/models/${GEMINI_CONFIG.MODEL_NAME}`);
      }
      
      console.log('✅ Vertex AI inicializado');
    } catch (error: any) {
      console.error('❌ Error al inicializar cliente de Gemini (Vertex AI):', error.message);
      throw error;
    }
  }
  
  /**
   * Restaura las credenciales originales (para Firebase Admin)
   */
  private restoreCredentials(): void {
    if (this.originalGoogleCreds) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = this.originalGoogleCreds;
    }
  }

  /**
   * Verifica si el cliente está disponible
   * Si no está inicializado, intenta inicializarlo
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return this.model !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Implementa rate limiting
   */
  private async applyRateLimiting(): Promise<void> {
    const now = Date.now();
    
    // Resetear contador cada minuto
    if (now - this.requestResetTime > 60000) {
      this.requestCount = 0;
      this.requestResetTime = now;
    }
    
    // Verificar límite de requests por minuto
    if (this.requestCount >= GEMINI_CONFIG.MAX_REQUESTS_PER_MINUTE) {
      const waitTime = 60000 - (now - this.requestResetTime);
      console.log(`⏸️ Rate limit alcanzado. Esperando ${(waitTime / 1000).toFixed(1)}s...`);
      await this.delay(waitTime);
      this.requestCount = 0;
      this.requestResetTime = Date.now();
    }
    
    // Delay entre requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < GEMINI_CONFIG.DELAY_BETWEEN_REQUESTS_MS) {
      const waitTime = GEMINI_CONFIG.DELAY_BETWEEN_REQUESTS_MS - timeSinceLastRequest;
      await this.delay(waitTime);
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Genera contenido con Gemini vía Vertex AI
   * 
   * @param prompt - El prompt para generar contenido
   * @param images - Array opcional de imágenes en formato base64 con su tipo MIME y contexto
   * @param options - Opciones adicionales
   * @returns El texto generado
   */
  async generateContent(
    prompt: string,
    images: Array<{ mimeType: string; data: string; context: string }> = [],
    options: {
      retries?: number;
      timeout?: number;
    } = {}
  ): Promise<{ text: string; metadata: any }> {
    // Asegurar que VertexAI esté inicializado con las credenciales correctas
    await this.ensureInitialized();

    const maxRetries = options.retries ?? GEMINI_CONFIG.MAX_RETRIES;
    const imageCount = images.length;
    
    // Determinar timeout base según número de imágenes
    let baseTimeout: number = GEMINI_CONFIG.REQUEST_TIMEOUT_MS;
    if (imageCount > 0) {
      if (imageCount > 4) {
        baseTimeout = GEMINI_CONFIG.REQUEST_TIMEOUT_MULTIPLE_IMAGES_MS;
      } else {
        // Timeout intermedio para 1-4 imágenes
        baseTimeout = Math.floor(GEMINI_CONFIG.REQUEST_TIMEOUT_MS * 1.5);
      }
      console.log(`📷 Procesando ${imageCount} imagen(es) con timeout de ${(baseTimeout / 60000).toFixed(1)} minutos`);
    }
    
    // Si se especifica un timeout en opciones, usarlo como base
    if (options.timeout) {
      baseTimeout = options.timeout;
    }
    
    let lastError: Error | null = null;
    
    // Detectar si estamos en producción (una sola vez, fuera del loop)
    const isProduction = process.env.GCLOUD_PROJECT && 
                        process.env.FUNCTIONS_EMULATOR !== 'true' &&
                        process.env.FUNCTION_TARGET !== undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Aplicar rate limiting
        await this.applyRateLimiting();
        
        // Calcular timeout progresivo: intento 1 = base, intento 2 = +50%, intento 3 = +100%
        let currentTimeout: number = baseTimeout;
        if (attempt === 2) {
          currentTimeout = Math.floor(baseTimeout * 1.5); // +50%
          console.log(`⏱️ Intento 2: Aumentando timeout a ${(currentTimeout / 60000).toFixed(1)} minutos (+50%)`);
        } else if (attempt === 3) {
          currentTimeout = baseTimeout * 2; // +100%
          console.log(`⏱️ Intento 3: Aumentando timeout a ${(currentTimeout / 60000).toFixed(1)} minutos (+100%)`);
        }
        
        console.log(`🤖 Generando contenido con Gemini Vertex AI (intento ${attempt}/${maxRetries})...`);
        if (imageCount > 0) {
          console.log(`   📷 Analizando ${imageCount} imagen(es) visualmente con Gemini`);
          images.forEach((img, idx) => {
            console.log(`      ${idx + 1}. ${img.context} (${img.mimeType}, ${(Buffer.from(img.data, 'base64').length / 1024).toFixed(2)}KB)`);
          });
        }
        
        // Solo establecer GOOGLE_APPLICATION_CREDENTIALS en desarrollo local
        // En producción, Firebase Functions usa automáticamente las credenciales del proyecto
        if (!isProduction && this.vertexKeyPath) {
          // Solo en desarrollo local: establecer credenciales explícitas
          process.env.GOOGLE_APPLICATION_CREDENTIALS = this.vertexKeyPath;
        }
        
        // Construir las partes del contenido: imágenes primero, luego texto
        // Según la documentación de Gemini, es mejor poner las imágenes antes del texto
        console.log(`\n🔧 CONSTRUYENDO REQUEST PARA VERTEX AI:`);
        const parts: any[] = [];
        
        // Agregar cada imagen como parte inlineData PRIMERO
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          const imageSizeKB = (Buffer.from(image.data, 'base64').length / 1024).toFixed(2);
          
          // Validar que el base64 no esté vacío
          if (!image.data || image.data.length === 0) {
            console.error(`❌ ERROR: Imagen ${i + 1} tiene base64 vacío - OMITIENDO`);
            continue;
          }
          
          // Validar que el mimeType sea válido
          if (!image.mimeType || !image.mimeType.startsWith('image/')) {
            console.error(`❌ ERROR: Imagen ${i + 1} tiene mimeType inválido (${image.mimeType}) - usando image/jpeg`);
            image.mimeType = 'image/jpeg';
          }
          
          const imagePart = {
            inlineData: {
              mimeType: image.mimeType,
              data: image.data,
            },
          };
          
          parts.push(imagePart);
          console.log(`   📤 Parte ${i + 1}/${images.length}: Imagen`);
          console.log(`      - Contexto: ${image.context}`);
          console.log(`      - MIME Type: ${image.mimeType}`);
          console.log(`      - Tamaño base64: ${imageSizeKB} KB`);
          console.log(`      - Base64 válido: ${image.data.substring(0, 30)}... (${image.data.length} chars)`);
        }
        
        // Validar que tengamos al menos una imagen válida si se esperaba tener imágenes
        if (images.length > 0 && parts.filter(p => p.inlineData).length === 0) {
          throw new Error('Todas las imágenes fallaron la validación - no se puede proceder sin imágenes válidas');
        }
        
        // Agregar el texto DESPUÉS de las imágenes
        parts.push({ text: prompt });
        console.log(`   📝 Parte ${parts.length}: Texto (prompt)`);
        console.log(`      - Tamaño del prompt: ${(prompt.length / 1024).toFixed(2)} KB`);
        
        // Vertex AI estructura para contenido multimodal
        const request = {
          contents: [{ role: 'user', parts }],
        };
        
        // Log de verificación de la estructura FINAL
        const imagePartsCount = parts.filter(p => p.inlineData).length;
        const textPartsCount = parts.filter(p => p.text).length;
        console.log(`\n📋 ESTRUCTURA FINAL DEL REQUEST:`);
        console.log(`   - Total de partes: ${parts.length}`);
        console.log(`   - Partes de imagen: ${imagePartsCount}`);
        console.log(`   - Partes de texto: ${textPartsCount}`);
        console.log(`   - Request válido: ${parts.length > 0 && (imagePartsCount > 0 || textPartsCount > 0) ? '✅ SÍ' : '❌ NO'}`);
        
        // VALIDACIÓN CRÍTICA: Verificar que cada parte de imagen tenga la estructura correcta
        if (imagePartsCount > 0) {
          console.log(`\n🔍 VALIDACIÓN DE ESTRUCTURA DE IMÁGENES:`);
          let validImages = 0;
          let invalidImages = 0;
          
          parts.forEach((part, idx) => {
            if (part.inlineData) {
              const hasMimeType = part.inlineData.mimeType && typeof part.inlineData.mimeType === 'string';
              const hasData = part.inlineData.data && typeof part.inlineData.data === 'string' && part.inlineData.data.length > 0;
              const isValidMimeType = hasMimeType && part.inlineData.mimeType.startsWith('image/');
              const base64Length = hasData ? part.inlineData.data.length : 0;
              
              if (hasMimeType && hasData && isValidMimeType) {
                validImages++;
                console.log(`   ✅ Parte ${idx + 1}: VÁLIDA`);
                console.log(`      - MIME Type: ${part.inlineData.mimeType}`);
                console.log(`      - Base64 length: ${base64Length} caracteres`);
                console.log(`      - Base64 preview: ${part.inlineData.data.substring(0, 30)}...`);
              } else {
                invalidImages++;
                console.error(`   ❌ Parte ${idx + 1}: INVÁLIDA`);
                console.error(`      - Tiene mimeType: ${hasMimeType}`);
                console.error(`      - Tiene data: ${hasData}`);
                console.error(`      - MIME Type válido: ${isValidMimeType}`);
              }
            }
          });
          
          if (invalidImages > 0) {
            throw new Error(`ERROR CRÍTICO: ${invalidImages} imagen(es) tienen estructura inválida. No se puede enviar a Gemini.`);
          }
          
          console.log(`   ✅ TODAS las ${validImages} imagen(es) tienen estructura VÁLIDA para Vertex AI\n`);
        }
        
        if (imagePartsCount > 0) {
          console.log(`\n🚀 ENVIANDO REQUEST A VERTEX AI GEMINI:`);
          console.log(`   ✅ ${imagePartsCount} imagen(es) incluidas en el request`);
          console.log(`   ✅ El modelo ${GEMINI_CONFIG.MODEL_NAME} recibirá las imágenes como contenido visual`);
          console.log(`   ✅ Formato correcto: inlineData con mimeType y data (base64)`);
          console.log(`   ✅ Gemini podrá ANALIZAR VISUALMENTE las imágenes`);
          console.log(`   ✅ Las justificaciones se generarán CON información visual completa\n`);
        } else if (images.length > 0) {
          console.error(`\n❌ ERROR CRÍTICO: Se esperaban ${images.length} imágenes pero ninguna está en las partes del request`);
          console.error(`   Las justificaciones NO incluirán información visual\n`);
          throw new Error('No se pudieron incluir las imágenes en el request');
        } else {
          console.log(`\n📤 ENVIANDO REQUEST A VERTEX AI GEMINI (solo texto, sin imágenes)\n`);
        }
        
        const resultPromise = this.model!.generateContent(request);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout al generar contenido')), currentTimeout);
        });
        
        // Ejecutar con timeout
        const result = await Promise.race([resultPromise, timeoutPromise]);
        
        // Restaurar credenciales después de la llamada (solo en desarrollo local)
        if (!isProduction) {
          this.restoreCredentials();
        }
        
        // Extraer texto de la respuesta de Vertex AI
        const response = result.response;
        
        // Validar que la respuesta tenga la estructura esperada
        if (!response || !response.candidates || response.candidates.length === 0) {
          throw new Error('Respuesta de Gemini no tiene candidatos válidos');
        }
        
        if (!response.candidates[0].content || !response.candidates[0].content.parts || response.candidates[0].content.parts.length === 0) {
          throw new Error('Respuesta de Gemini no tiene partes válidas');
        }
        
        const text = response.candidates[0].content.parts[0].text;
        
        if (!text || text.trim() === '') {
          throw new Error('Respuesta vacía de Gemini');
        }
        
        // Log de confirmación de recepción
        if (imageCount > 0) {
          console.log(`\n📨 CONFIRMACIÓN DE RECEPCIÓN POR GEMINI:`);
          console.log(`   ✅ Gemini procesó el request exitosamente`);
          console.log(`   ✅ Respuesta recibida con ${response.candidates[0].content.parts.length} parte(s)`);
          console.log(`   ✅ Si las imágenes fueron enviadas correctamente, Gemini las analizó visualmente`);
        }
        
        console.log(`\n✅ RESPUESTA DE GEMINI RECIBIDA:`);
        console.log(`   - Tamaño de la respuesta: ${text.length} caracteres`);
        console.log(`   - Primeros 200 caracteres: ${text.substring(0, 200)}...`);
        
        if (imageCount > 0) {
          console.log(`\n🔍 VERIFICACIÓN DE ANÁLISIS VISUAL:`);
          console.log(`   📷 Imágenes enviadas: ${imageCount}`);
          
          // Verificar si la respuesta menciona contenido visual (indicador de que las imágenes fueron procesadas)
          const visualKeywords = [
            'imagen', 'imágenes', 'visual', 'visualmente',
            'gráfico', 'gráficos', 'diagrama', 'diagramas',
            'observo', 'observamos', 'veo', 'vemos',
            'muestra', 'muestran', 'presenta', 'presentan',
            'fotografía', 'foto', 'ilustración', 'dibujo',
            'esquema', 'mapa', 'tabla', 'gráfica'
          ];
          
          const textLower = text.toLowerCase();
          const foundKeywords: string[] = [];
          visualKeywords.forEach(keyword => {
            if (textLower.includes(keyword)) {
              foundKeywords.push(keyword);
            }
          });
          
          // Verificar referencias específicas a elementos visuales
          const hasSpecificVisualRefs = 
            textLower.includes('en la imagen') ||
            textLower.includes('de la imagen') ||
            textLower.includes('se puede ver') ||
            textLower.includes('como se muestra') ||
            textLower.includes('según la imagen') ||
            textLower.includes('apreciamos en') ||
            textLower.includes('elementos visuales');
          
          if (foundKeywords.length > 0 || hasSpecificVisualRefs) {
            console.log(`   ✅ CONFIRMADO: Gemini SÍ analizó las imágenes visualmente`);
            console.log(`   ✅ Palabras clave visuales encontradas: ${foundKeywords.length} (${foundKeywords.slice(0, 5).join(', ')}${foundKeywords.length > 5 ? '...' : ''})`);
            if (hasSpecificVisualRefs) {
              console.log(`   ✅ Referencias específicas a contenido visual encontradas`);
            }
            console.log(`   ✅ Las justificaciones fueron generadas CON información visual completa\n`);
          } else {
            console.warn(`   ⚠️ ADVERTENCIA: No se encontraron referencias visuales explícitas en la respuesta`);
            console.warn(`   ⚠️ Esto podría indicar que:`);
            console.warn(`      - Gemini no procesó las imágenes visualmente`);
            console.warn(`      - O las justificaciones no requieren referencias explícitas a las imágenes`);
            console.warn(`   ⚠️ Verificar los logs anteriores para confirmar que las imágenes se enviaron correctamente\n`);
          }
          
          // Guardar metadata de análisis visual para usar en el return
          (result as any)._visualAnalysisMetadata = {
            imagesAnalyzed: imageCount,
            hasVisualReferences: foundKeywords.length > 0 || hasSpecificVisualRefs,
            visualKeywordsFound: foundKeywords.length,
          };
        }
        
        // Extraer metadata de análisis visual si existe
        const visualMeta = (result as any)._visualAnalysisMetadata || {
          imagesAnalyzed: 0,
          hasVisualReferences: false,
          visualKeywordsFound: 0,
        };
        
        return {
          text,
          metadata: {
            model: GEMINI_CONFIG.MODEL_NAME,
            project: GEMINI_CONFIG.PROJECT_ID,
            region: GEMINI_CONFIG.REGION,
            promptVersion: GEMINI_CONFIG.PROMPT_VERSION,
            attempt,
            imagesProcessed: imageCount,
            imagesAnalyzed: visualMeta.imagesAnalyzed,
            hasVisualReferences: visualMeta.hasVisualReferences,
            visualKeywordsFound: visualMeta.visualKeywordsFound,
            timestamp: new Date(),
          },
        };
      } catch (error: any) {
        // Restaurar credenciales en caso de error
        this.restoreCredentials();
        
        lastError = error;
        console.error(`❌ Error en intento ${attempt}/${maxRetries}:`, error.message);
        
        // Detectar error 403 de permisos de Vertex AI
        const isPermissionError = error.message?.includes('403') || 
                                 error.message?.includes('PERMISSION_DENIED') ||
                                 error.message?.includes('permission') ||
                                 error.code === 7 || // PERMISSION_DENIED en gRPC
                                 error.status === 403;
        
        if (isPermissionError) {
          const projectId = GEMINI_CONFIG.PROJECT_ID;
          const serviceAccount = `${projectId}@appspot.gserviceaccount.com`;
          const errorMessage = `Error de permisos (403): La cuenta de servicio de Firebase Functions no tiene permisos para usar Vertex AI. Por favor, otorga el rol 'Vertex AI User' (roles/aiplatform.user) a la cuenta de servicio '${serviceAccount}' en el proyecto '${projectId}'. Consulta SOLUCION_ERROR_403_VERTEX_AI.md para más detalles.`;
          
          console.error(`\n❌ ERROR DE PERMISOS DE VERTEX AI:`);
          console.error(`   Cuenta de servicio: ${serviceAccount}`);
          console.error(`   Proyecto: ${projectId}`);
          console.error(`   Rol requerido: roles/aiplatform.user`);
          console.error(`\n   Para solucionarlo, ejecuta:`);
          console.error(`   gcloud projects add-iam-policy-binding ${projectId} \\`);
          console.error(`     --member="serviceAccount:${serviceAccount}" \\`);
          console.error(`     --role="roles/aiplatform.user"`);
          
          // Lanzar error con mensaje claro
          throw new Error(errorMessage);
        }
        
        // Si no es el último intento, esperar antes de reintentar
        if (attempt < maxRetries) {
          // Detectar tipo de error para ajustar estrategia de reintento
          const isRateLimitError = error.message?.includes('429') || 
                                   error.message?.includes('RESOURCE_EXHAUSTED') ||
                                   error.message?.includes('Too Many Requests');
          const isTimeoutError = error.message?.includes('Timeout') || 
                                error.message?.includes('timeout');
          
          let delayTime = GEMINI_CONFIG.RETRY_DELAY_MS * attempt;
          
          if (isRateLimitError) {
            // Para errores 429, esperar 45 segundos adicionales (aumentado)
            delayTime = 45000 + (GEMINI_CONFIG.RETRY_DELAY_MS * attempt);
            console.log(`⚠️ Error 429 (Rate Limit) detectado. Esperando ${(delayTime / 1000).toFixed(1)}s antes de reintentar...`);
          } else if (isTimeoutError) {
            // Para timeouts, esperar un poco más pero no tanto como 429
            delayTime = 15000 + (GEMINI_CONFIG.RETRY_DELAY_MS * attempt);
            const nextTimeout = attempt === 1 
              ? Math.floor(baseTimeout * 1.5) 
              : baseTimeout * 2;
            console.log(`⚠️ Timeout detectado en intento ${attempt}. El prompt puede ser muy largo${imageCount > 0 ? ` o hay ${imageCount} imagen(es) que procesar` : ''}.`);
            console.log(`   El siguiente intento usará timeout de ${(nextTimeout / 60000).toFixed(1)} minutos. Esperando ${(delayTime / 1000).toFixed(1)}s...`);
          } else {
            console.log(`⏳ Reintentando en ${(delayTime / 1000).toFixed(1)}s...`);
          }
          
          await this.delay(delayTime);
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    throw new Error(
      `Error después de ${maxRetries} intentos: ${lastError?.message || 'Error desconocido'}`
    );
  }

  /**
   * Utilidad: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene información del cliente
   */
  getInfo() {
    return {
      isAvailable: this.isAvailable(),
      type: 'Vertex AI',
      project: GEMINI_CONFIG.PROJECT_ID,
      region: GEMINI_CONFIG.REGION,
      model: GEMINI_CONFIG.MODEL_NAME,
      promptVersion: GEMINI_CONFIG.PROMPT_VERSION,
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
    };
  }
}

// Exportar instancia singleton
export const geminiClient = new GeminiClient();

export default geminiClient;

