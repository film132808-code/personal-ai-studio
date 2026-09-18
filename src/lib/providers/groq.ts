import { NormalizedModel } from '@/types'
import { ProviderAdapter, detectCapabilities } from './types'

export const groqAdapter: ProviderAdapter = {
  provider: 'groq',
  async validateKey(apiKey: string) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      return { valid: res.ok, error: res.ok ? undefined : 'Invalid Groq key' }
    } catch (e: any) {
      return { valid: false, error: e.message }
    }
  },
  async listModels(apiKey: string): Promise<NormalizedModel[]> {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` }
    })
    const data = await res.json()
    return (data.data || []).map((m: any) => ({
      id: m.id,
      provider: 'groq' as const,
      displayName: m.id,
      contextLength: m.context_window,
      capabilities: detectCapabilities(m.id),
      pricing: { isFree: false, isFreeConfirmed: false },
      metadata: m,
      lastChecked: new Date().toISOString()
    }))
  },
  async streamChat({ apiKey, model, messages, onChunk }) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages, stream: true })
    })
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
  getCapabilities() { return ['chat', 'tools', 'coding'] }
}
