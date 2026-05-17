import { createOpenAI } from 'npm:@ai-sdk/openai@^1.0.0';

export const DEFAULT_MODEL = 'google/gemini-2.5-flash-preview';
export const FAST_MODEL    = 'google/gemini-2.5-flash-preview';

export function createLovableAiGatewayProvider() {
  const apiKey = Deno.env.get('LOVABLE_API_KEY') ?? '';
  return createOpenAI({
    baseURL: 'https://lovable.ai/api/ai-gateway/v1',
    apiKey,
    compatibility: 'compatible',
  });
}
