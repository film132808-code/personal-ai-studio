import { NormalizedModel } from '@/types'
import { ProviderAdapter, detectCapabilities } from './types'

export const geminiAdapter: ProviderAdapter = {
  provider: 'gemini',
  async validateKey(apiKey: string) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      return { valid: res.ok, error: res.ok ? undefined : 'Invalid Gemini key' }
    } catch (e: any) {
      return { valid: false, error: e.message }
    }
  },
  async listModels(apiKey: string): Promise<NormalizedModel[]> {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    const data = await res.json()
    return (data.models || []).map((m: any) => ({
      id: m.name.replace('models/', ''),
      provider: 'gemini' as const,
      displayName: m.displayName || m.name,
      contextLength: m.inputTokenLimit,
      capabilities: {
        chat: true,
        vision: m.supportedGenerationMethods?.includes('generateContent'),
        tools: true,
        coding: true,
        reasoning: m.name.includes('thinking'),
        imageGeneration: m.name.includes('imagen'),
        imageEditing: false,
        videoGeneration: m.name.includes('veo'),
        audio: false
      },
      pricing: { isFree: false, isFreeConfirmed: false },
      metadata: m,
      lastChecked: new Date().toISOString()
    }))
  },
  async streamChat({ apiKey, model, messages, onChunk }) {
    // Simplified non-streaming for demo, will be enhanced
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    })
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    onChunk(text)
    return text
  },
  getCapabilities() { return ['chat', 'vision', 'tools'] }
}
