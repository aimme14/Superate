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

/** Tope para llamadas Vertex cortas (justificaciones, imágenes, etc.). */
const VERTEX_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Plan de estudio y resúmenes académicos largos.
 * Debe ser menor que `timeoutSeconds` de `superateHttp` (Cloud Functions, p. ej. 540s).
 */
const VERTEX_LONG_GENERATION_TIMEOUT_MS = 300_000;

/**
 * Configuración de Gemini
 * Región/modelo/credenciales locales desde .env; el proyecto de Vertex AI es fijo en superate-ia
 * (las Functions pueden desplegarse en otro proyecto Firebase; IAM cruza al dar Vertex AI User allí).
 */
export const GEMINI_CONFIG = {
  PROJECT_ID: 'superate-ia',
  REGION: process.env.VERTEX_AI_REGION || process.env.GEMINI_REGION || 'us-central1',
  MODEL_NAME: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  VERTEX_AI_CREDENTIALS: process.env.VERTEX_AI_CREDENTIALS || './serviceAccountKey-ia.json',
  PROMPT_VERSION: '2.5.0',

  /** Plan de estudio / resumen académico (generaciones largas). */
  GENERATION_SUMMARY_AND_PLAN_TIMEOUT_MS: VERTEX_LONG_GENERATION_TIMEOUT_MS,

  /** Timeout base para `generateContent` (texto o imágenes); reintentos no lo superan salvo `options.timeout`. */
  REQUEST_TIMEOUT_MS: VERTEX_REQUEST_TIMEOUT_MS,
  /** Antes distinto para >4 imágenes; mismo tope corto que la mayoría de rutas. */
  REQUEST_TIMEOUT_MULTIPLE_IMAGES_MS: VERTEX_REQUEST_TIMEOUT_MS,
  
  // Límites de rate limiting (valores fijos, no configurables desde .env)
  MAX_REQUESTS_PER_MINUTE: 10, // Reducido para evitar errores 429
  DELAY_BETWEEN_REQUESTS_MS: 2000, // Aumentado a 2 segundos entre requests
  
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
  maxOutputTokens: 65536, // Para planes de estudio y resúmenes largos
};

/** Config para justificaciones: respuestas más cortas, menor costo en Vertex AI. */
export const justificationGenerationConfig = {
  temperature: 0.8,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 4096,
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
        // Asegurar que GOOGLE_APPLICATION_CREDENTIALS no esté establecido en producción
        // Firebase Functions debe usar las credenciales del servicio automáticamente
        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
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
      /** Vertex: fuerza salida JSON (reduce texto extra y mejora parseo). */
      responseMimeType?: 'application/json';
      /** Override de maxOutputTokens para esta llamada (p. ej. 4096 para justificaciones). */
      maxOutputTokens?: number;
    } = {}
  ): Promise<{ text: string; metadata: any }> {
    // Asegurar que VertexAI esté inicializado con las credenciales correctas
    await this.ensureInitialized();

    const maxRetries = options.retries ?? GEMINI_CONFIG.MAX_RETRIES;
    const imageCount = images.length;
    const timeoutCap = options.timeout ?? GEMINI_CONFIG.REQUEST_TIMEOUT_MS;

    let baseTimeout: number = GEMINI_CONFIG.REQUEST_TIMEOUT_MS;
    if (options.timeout) {
      baseTimeout = options.timeout;
    }
    if (imageCount > 0) {
      console.log(
        `📷 Procesando ${imageCount} imagen(es) con timeout de ${(Math.min(baseTimeout, timeoutCap) / 1000).toFixed(0)}s`
      );
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
        
        // Reintentos: subir tope por intento pero no pasar de timeoutCap (30s por defecto = mismo que Cloud Functions)
        let currentTimeout: number = baseTimeout;
        if (attempt === 2) {
          currentTimeout = Math.floor(baseTimeout * 1.5);
        } else if (attempt === 3) {
          currentTimeout = baseTimeout * 2;
        }
        currentTimeout = Math.min(currentTimeout, timeoutCap);
        if (attempt > 1) {
          console.log(`⏱️ Intento ${attempt}: timeout ${(currentTimeout / 1000).toFixed(0)}s (tope ${(timeoutCap / 1000).toFixed(0)}s)`);
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
        const parts: any[] = [];
        
        // Agregar cada imagen como parte inlineData PRIMERO
        for (let i = 0; i < images.length; i++) {
          const image = images[i];
          
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
        }
        
        // Validar que tengamos al menos una imagen válida si se esperaba tener imágenes
        if (images.length > 0 && parts.filter(p => p.inlineData).length === 0) {
          throw new Error('Todas las imágenes fallaron la validación - no se puede proceder sin imágenes válidas');
        }
        
        // Agregar el texto DESPUÉS de las imágenes
        parts.push({ text: prompt });
        
        // Vertex AI estructura para contenido multimodal
        const request: {
          contents: { role: string; parts: any[] }[];
          generationConfig?: typeof generationConfig & { responseMimeType?: string; maxOutputTokens?: number };
        } = {
          contents: [{ role: 'user', parts }],
        };
        if (options.responseMimeType || options.maxOutputTokens) {
          request.generationConfig = {
            ...generationConfig,
            ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
            ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
          };
        }
        
        const imagePartsCount = parts.filter(p => p.inlineData).length;

        if (imagePartsCount > 0) {
          let invalidImages = 0;

          parts.forEach((part) => {
            if (part.inlineData) {
              const hasMimeType = part.inlineData.mimeType && typeof part.inlineData.mimeType === 'string';
              const hasData = part.inlineData.data && typeof part.inlineData.data === 'string' && part.inlineData.data.length > 0;
              const isValidMimeType = hasMimeType && part.inlineData.mimeType.startsWith('image/');

              if (!(hasMimeType && hasData && isValidMimeType)) {
                invalidImages++;
              }
            }
          });

          if (invalidImages > 0) {
            throw new Error(`ERROR CRÍTICO: ${invalidImages} imagen(es) tienen estructura inválida. No se puede enviar a Gemini.`);
          }
        }

        if (images.length > 0 && imagePartsCount === 0) {
          throw new Error('No se pudieron incluir las imágenes en el request');
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
        
        if (imageCount > 0) {
          (result as any)._visualAnalysisMetadata = {
            imagesAnalyzed: imageCount,
            hasVisualReferences: false,
            visualKeywordsFound: 0,
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
            usageMetadata: response.usageMetadata || null,
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
          const vertexProjectId = GEMINI_CONFIG.PROJECT_ID;
          // La identidad que llama a Vertex es la del proyecto donde corre Cloud Functions (GCLOUD_PROJECT),
          // no necesariamente la del proyecto Vertex (VERTEX_AI_PROJECT_ID). Si difieren, el IAM debe
          // otorgarse en vertexProjectId al miembro serviceAccount:... del proyecto de Firebase.
          const firebaseProjectId =
            process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || vertexProjectId;
          const serviceAccount = `${firebaseProjectId}@appspot.gserviceaccount.com`;
          const crossProject =
            firebaseProjectId !== vertexProjectId
              ? ` (Las funciones están en '${firebaseProjectId}' y Vertex en '${vertexProjectId}': otorga el rol en el proyecto Vertex '${vertexProjectId}' al miembro de la cuenta anterior.)`
              : '';
          const errorMessage = `Error de permisos (403): La cuenta de servicio que ejecuta Cloud Functions (${serviceAccount}) no tiene permiso para usar Vertex AI en el proyecto '${vertexProjectId}'. Otorga el rol 'Vertex AI User' (roles/aiplatform.user) a esa cuenta en el proyecto '${vertexProjectId}' (IAM → conceder acceso).${crossProject}`;
          
          console.error(`\n❌ ERROR DE PERMISOS DE VERTEX AI:`);
          console.error(`   Proyecto Firebase (funciones): ${firebaseProjectId}`);
          console.error(`   Cuenta de servicio que invoca la API: ${serviceAccount}`);
          console.error(`   Proyecto Vertex (recurso/API): ${vertexProjectId}`);
          console.error(`   Rol requerido en '${vertexProjectId}': roles/aiplatform.user`);
          console.error(`\n   Ejemplo (si Vertex está en ${vertexProjectId} y las funciones en ${firebaseProjectId}):`);
          console.error(`   gcloud projects add-iam-policy-binding ${vertexProjectId} \\`);
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
            let nextTimeout = attempt === 1 ? Math.floor(baseTimeout * 1.5) : baseTimeout * 2;
            nextTimeout = Math.min(nextTimeout, timeoutCap);
            console.log(`⚠️ Timeout detectado en intento ${attempt}. El prompt puede ser muy largo${imageCount > 0 ? ` o hay ${imageCount} imagen(es) que procesar` : ''}.`);
            console.log(`   El siguiente intento usará timeout de ${(nextTimeout / 1000).toFixed(0)}s. Esperando ${(delayTime / 1000).toFixed(1)}s...`);
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

