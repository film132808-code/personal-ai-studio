import { NormalizedModel } from '@/types'

export interface ProviderAdapter {
  provider: string
  validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }>
  listModels(apiKey: string): Promise<NormalizedModel[]>
  streamChat(params: {
    apiKey: string
    model: string
    messages: { role: string; content: string }[]
    onChunk: (chunk: string) => void
  }): Promise<string>
  getCapabilities(): string[]
}

export function detectCapabilities(modelId: string): any {
  const id = modelId.toLowerCase()
  return {
    chat: true,
    vision: id.includes('vision') || id.includes('gpt-4') || id.includes('claude-3') || id.includes('gemini'),
    tools: id.includes('gpt-4') || id.includes('claude') || id.includes('gemini') || id.includes('llama') || id.includes('tool'),
    coding: id.includes('code') || id.includes('codestral') || id.includes('deepseek') || id.includes('claude') || id.includes('gpt'),
    reasoning: id.includes('o1') || id.includes('reasoning') || id.includes('r1') || id.includes('thinking'),
    imageGeneration: id.includes('dall-e') || id.includes('imagen') || id.includes('flux') || id.includes('midjourney') || id.includes('stable-diffusion'),
    imageEditing: id.includes('dall-e') || id.includes('inpaint'),
    videoGeneration: id.includes('sora') || id.includes('veo') || id.includes('video') || id.includes('runway'),
    audio: id.includes('whisper') || id.includes('tts') || id.includes('audio')
  }
}
