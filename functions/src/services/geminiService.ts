import { geminiClient } from '../config/gemini.config';

interface GeminiCallOptions {
  retries?: number;
  timeout?: number;
  responseMimeType?: 'application/json';
  /** Override de maxOutputTokens para esta llamada. */
  maxOutputTokens?: number;
  /** Tope de thinking tokens (guardrail de costo). 0 = sin thinking. */
  thinkingBudget?: number;
}

interface GeminiCallInput {
  userId: string;
  prompt: string;
  processName: string;
  images?: Array<{ mimeType: string; data: string; context: string }>;
  /** Reenviado a Vertex (retries, timeout, responseMimeType, maxOutputTokens, etc.). */
  options?: GeminiCallOptions;
}

class GeminiCentralizedService {
  async generateContent(input: GeminiCallInput): Promise<{ text: string; metadata: any }> {
    const images = input.images || [];
    const options = input.options || {};
    const startedAt = Date.now();

    try {
      const result = await geminiClient.generateContent(input.prompt, images, options);
      const u = result?.metadata?.usageMetadata || {};
      console.log(JSON.stringify({
        event: 'gemini_usage',
        processName: input.processName,
        userId: input.userId,
        model: result?.metadata?.model,
        attempt: result?.metadata?.attempt ?? null, // >1 = hubo reintentos
        success: true,
        latencyMs: Date.now() - startedAt,
        imagesProcessed: images.length,
        promptChars: input.prompt.length,
        responseChars: result?.text?.length ?? 0,
        promptTokenCount: u.promptTokenCount ?? null,
        candidatesTokenCount: u.candidatesTokenCount ?? null,
        totalTokenCount: u.totalTokenCount ?? null,
        thoughtsTokenCount: u.thoughtsTokenCount ?? null, // thinking oculto
        thinkingBudget: options.thinkingBudget ?? null, // para filtrar pre/post en Logs
        errorType: null,
      }));
      return result;
    } catch (error: any) {
      const msg = String(error?.message || error);
      const errorType =
        /timeout/i.test(msg) ? 'timeout' :
        /429|RESOURCE_EXHAUSTED/i.test(msg) ? '429' :
        /403|PERMISSION_DENIED|permission/i.test(msg) ? 'permission' :
        'other';
      console.log(JSON.stringify({
        event: 'gemini_usage',
        processName: input.processName,
        userId: input.userId,
        success: false,
        latencyMs: Date.now() - startedAt,
        imagesProcessed: images.length,
        promptChars: input.prompt.length,
        thinkingBudget: options.thinkingBudget ?? null,
        errorType,
        errorMessage: msg.slice(0, 300),
      }));
      throw error;
    }
  }
}

export const geminiCentralizedService = new GeminiCentralizedService();
