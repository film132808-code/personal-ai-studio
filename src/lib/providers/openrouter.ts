import { NormalizedModel } from '@/types'
import { ProviderAdapter, detectCapabilities } from './types'

export const openRouterAdapter: ProviderAdapter = {
  provider: 'openrouter',
  async validateKey(apiKey: string) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/key', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (res.ok) return { valid: true }
      return { valid: false, error: 'Invalid OpenRouter key' }
    } catch (e: any) {
      return { valid: false, error: e.message }
    }
  },
  async listModels(apiKey: string): Promise<NormalizedModel[]> {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    if (!res.ok) throw new Error('Failed to fetch models')
    const data = await res.json()
    return data.data.map((m: any) => ({
      id: m.id,
      provider: 'openrouter' as const,
      displayName: m.name || m.id,
      contextLength: m.context_length,
      capabilities: detectCapabilities(m.id),
      pricing: {
        input: parseFloat(m.pricing?.prompt || '0'),
        output: parseFloat(m.pricing?.completion || '0'),
        isFree: m.pricing?.prompt === '0' && m.pricing?.completion === '0',
        isFreeConfirmed: true
      },
      metadata: m,
      lastChecked: new Date().toISOString()
    }))
  },
  async streamChat({ apiKey, model, messages, onChunk }) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://personal-ai-studio.netlify.app',
        'X-Title': 'Personal AI Studio'
      },
      body: JSON.stringify({ model, messages, stream: true })
    })
    if (!res.ok) throw new Error('OpenRouter chat failed')
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let full = ''
    if (!reader) throw new Error('No reader')
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.replace('data: ', '').trim()
        if (data === '[DONE]') break
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            full += delta
            onChunk(delta)
          }
        } catch {}
      }
    }
    return full
  },
  getCapabilities() { return ['chat', 'vision', 'tools', 'coding'] }
}
