import { geminiClient } from '../config/gemini.config';

interface GeminiCallOptions {
  retries?: number;
  timeout?: number;
  responseMimeType?: 'application/json';
  /** Override de maxOutputTokens para esta llamada. */
  maxOutputTokens?: number;
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

    try {
      const result = await geminiClient.generateContent(input.prompt, images, options);

      return result;
    } catch (error: any) {
      throw error;
    }
  }
}

export const geminiCentralizedService = new GeminiCentralizedService();
