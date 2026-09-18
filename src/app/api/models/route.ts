import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/security/encryption'

function detectCapabilities(modelId: string) {
  const id = modelId.toLowerCase()
  return {
    chat: true,
    vision: id.includes('vision') || id.includes('gpt-4') || id.includes('claude-3') || id.includes('gemini') || id.includes('llava') || id.includes('mercury'),
    tools: id.includes('gpt-4') || id.includes('claude') || id.includes('gemini') || id.includes('llama') || id.includes('tool') || id.includes('function') || id.includes('mercury'),
    coding: id.includes('code') || id.includes('codestral') || id.includes('deepseek') || id.includes('claude') || id.includes('gpt') || id.includes('coder') || id.includes('mercury'),
    reasoning: id.includes('o1') || id.includes('reasoning') || id.includes('r1') || id.includes('thinking') || id.includes('qwq') || id.includes('mercury'),
    imageGeneration: id.includes('dall-e') || id.includes('imagen') || id.includes('flux') || id.includes('stable-diffusion') || id.includes('midjourney'),
    imageEditing: id.includes('dall-e') || id.includes('inpaint'),
    videoGeneration: id.includes('sora') || id.includes('veo') || id.includes('video') || id.includes('runway'),
    audio: id.includes('whisper') || id.includes('tts') || id.includes('audio')
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const providerFilter = searchParams.get('provider')
    const refresh = searchParams.get('refresh') === 'true'

    // Get user's provider connections
    let query = supabase.from('provider_connections').select('*').eq('user_id', user.id).eq('enabled', true)
    if (providerFilter) {
      query = query.eq('provider', providerFilter)
    }

    const { data: connections, error: connError } = await query
    if (connError) throw connError

    if (!connections || connections.length === 0) {
      return NextResponse.json({ models: [], message: 'No providers connected' })
    }

    let allModels: any[] = []

    for (const conn of connections) {
      try {
        const apiKey = decrypt(conn.encrypted_api_key)
        let models: any[] = []
        const isCustom = (conn as any).is_custom || !['openrouter', 'gemini', 'groq'].includes(conn.provider)
        const baseUrl = (conn as any).base_url
        const displayName = (conn as any).display_name || conn.provider

        if (conn.provider === 'openrouter' || conn.provider.includes('openrouter')) {
          const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            next: { revalidate: refresh ? 0 : 3600 }
          })
          if (res.ok) {
            const data = await res.json()
            models = data.data.map((m: any) => ({
              id: m.id,
              provider: conn.provider,
              displayName: m.name || m.id,
              contextLength: m.context_length,
              capabilities: detectCapabilities(m.id),
              pricing: {
                input: parseFloat(m.pricing?.prompt || '0'),
                output: parseFloat(m.pricing?.completion || '0'),
                isFree: m.pricing?.prompt === '0' && m.pricing?.completion === '0',
                isFreeConfirmed: true
              },
              metadata: { description: m.description },
              lastChecked: new Date().toISOString()
            }))
          }
        } else if (conn.provider === 'gemini') {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
          if (res.ok) {
            const data = await res.json()
            models = (data.models || []).map((m: any) => ({
              id: m.name.replace('models/', ''),
              provider: 'gemini',
              displayName: m.displayName || m.name,
              contextLength: m.inputTokenLimit,
              capabilities: {
                chat: true,
                vision: true,
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
          }
        } else if (conn.provider === 'groq') {
          const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }
          })
          if (res.ok) {
            const data = await res.json()
            models = (data.data || []).map((m: any) => ({
              id: m.id,
              provider: 'groq',
              displayName: m.id,
              contextLength: m.context_window,
              capabilities: detectCapabilities(m.id),
              pricing: { isFree: false, isFreeConfirmed: false },
              metadata: m,
              lastChecked: new Date().toISOString()
            }))
          }
        } else {
          // Custom provider - try OpenAI-compatible
          const endpoints = [
            baseUrl ? `${baseUrl.replace(/\/$/, '')}/models` : null,
            baseUrl ? `${baseUrl}/v1/models` : null,
            `https://api.inceptionlabs.ai/v1/models`,
            `https://api.unorouter.com/v1/models`,
          ].filter(Boolean) as string[]

          let fetched = false
          for (const endpoint of endpoints) {
            try {
              const res = await fetch(endpoint, {
                headers: { 
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json'
                }
              })
              if (res.ok) {
                const data = await res.json()
                const modelList = data.data || data.models || data
                if (Array.isArray(modelList) && modelList.length > 0) {
                  models = modelList.map((m: any) => {
                    const modelId = m.id || m.name || m.model || 'unknown'
                    return {
                      id: modelId,
                      provider: conn.provider,
                      displayName: m.name || m.displayName || modelId,
                      contextLength: m.context_length || m.contextLength || m.max_tokens || 128000,
                      capabilities: detectCapabilities(modelId),
                      pricing: { 
                        isFree: modelId.toLowerCase().includes('free') || displayName.toLowerCase().includes('free'),
                        isFreeConfirmed: false 
                      },
                      metadata: m,
                      lastChecked: new Date().toISOString()
                    }
                  })
                  fetched = true
                  break
                }
              }
            } catch (e) {
              continue
            }
          }

          // If no models fetched via API, create a placeholder model for custom provider
          // So user can still chat with it (e.g., mercury-2.5)
          if (!fetched) {
            // For Inception Labs, we know mercury models
            if (conn.provider.includes('incp') || baseUrl?.includes('inceptionlabs')) {
              models = [
                {
                  id: 'mercury-2.5',
                  provider: conn.provider,
                  displayName: 'Mercury 2.5 (Inception Labs)',
                  contextLength: 128000,
                  capabilities: detectCapabilities('mercury-2.5'),
                  pricing: { isFree: false, isFreeConfirmed: false },
                  metadata: { custom: true },
                  lastChecked: new Date().toISOString()
                },
                {
                  id: 'mercury-2.5-mini',
                  provider: conn.provider,
                  displayName: 'Mercury 2.5 Mini',
                  contextLength: 128000,
                  capabilities: detectCapabilities('mercury-2.5-mini'),
                  pricing: { isFree: false, isFreeConfirmed: false },
                  metadata: { custom: true },
                  lastChecked: new Date().toISOString()
                }
              ]
            } else if (conn.provider.includes('uno') || baseUrl?.includes('unorouter')) {
              // UnoRouter - try to list common models
              models = [
                {
                  id: 'openai/gpt-4o',
                  provider: conn.provider,
                  displayName: 'GPT-4o via UnoRouter',
                  contextLength: 128000,
                  capabilities: detectCapabilities('gpt-4o'),
                  pricing: { isFree: false, isFreeConfirmed: false },
                  metadata: { custom: true },
                  lastChecked: new Date().toISOString()
                }
              ]
            } else {
              // Generic custom - use provider id as model id
              models = [
                {
                  id: displayName || conn.provider,
                  provider: conn.provider,
                  displayName: displayName || conn.provider,
                  contextLength: 128000,
                  capabilities: detectCapabilities(displayName || conn.provider),
                  pricing: { isFree: false, isFreeConfirmed: false },
                  metadata: { custom: true, baseUrl },
                  lastChecked: new Date().toISOString()
                }
              ]
            }
          }
        }

        allModels.push(...models)
      } catch (e) {
        console.error(`Failed to fetch models for ${conn.provider}:`, e)
      }
    }

    return NextResponse.json({ 
      models: allModels,
      total: allModels.length,
      providers: connections.map(c => c.provider)
    })

  } catch (e: any) {
    console.error('Models fetch error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
