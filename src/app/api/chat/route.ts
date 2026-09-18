import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/security/encryption'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { messages, model, provider, conversationId, mode } = await req.json()

    if (!messages || !model || !provider) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // Get provider key
    const { data: conn, error: connError } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('enabled', true)
      .single()

    if (connError || !conn) {
      return new Response(JSON.stringify({ error: 'Provider not connected' }), { status: 400 })
    }

    const apiKey = decrypt(conn.encrypted_api_key)
    const baseUrl = (conn as any).base_url
    const isCustom = (conn as any).is_custom || !['openrouter', 'gemini', 'groq'].includes(provider)

    // Create streaming response
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = ''

          if (provider === 'openrouter' || provider.includes('openrouter')) {
            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://myailab.netlify.app',
                'X-Title': 'Personal AI Studio'
              },
              body: JSON.stringify({
                model,
                messages,
                stream: true,
                temperature: 0.7
              })
            })

            if (!res.ok) {
              const err = await res.text()
              throw new Error(`OpenRouter error: ${err}`)
            }

            const reader = res.body?.getReader()
            const decoder = new TextDecoder()
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
                    fullResponse += delta
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
                  }
                } catch {}
              }
            }
          } else if (provider === 'groq') {
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
                    fullResponse += delta
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
                  }
                } catch {}
              }
            }
          } else if (provider === 'gemini') {
            // Gemini
            const contents = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }))
            
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents })
            })

            const data = await res.json()
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
            fullResponse = text
            
            for (let i = 0; i < text.length; i += 5) {
              const chunk = text.slice(i, i + 5)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
              await new Promise(r => setTimeout(r, 20))
            }
          } else {
            // Custom provider - OpenAI compatible
            // Try different base URLs
            const tryUrls = [
              baseUrl ? `${baseUrl.replace(/\/$/, '')}/chat/completions` : null,
              baseUrl ? `${baseUrl.replace(/\/$/, '')}/v1/chat/completions` : null,
              `https://api.inceptionlabs.ai/v1/chat/completions`,
              `https://api.unorouter.com/v1/chat/completions`,
              `https://api.openai.com/v1/chat/completions`
            ].filter(Boolean) as string[]

            let chatUrl = tryUrls[0]
            // If baseUrl is provided, use it, otherwise try to infer
            if (baseUrl) {
              // Ensure it ends with /chat/completions
              if (baseUrl.includes('/chat/completions')) {
                chatUrl = baseUrl
              } else if (baseUrl.endsWith('/v1')) {
                chatUrl = `${baseUrl}/chat/completions`
              } else {
                chatUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`
              }
            }

            console.log(`Trying custom provider ${provider} at ${chatUrl} with model ${model}`)

            const res = await fetch(chatUrl, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: model.includes('/') ? model.split('/').pop() : model,
                messages,
                stream: true,
                temperature: 0.7
              })
            })

            if (!res.ok) {
              const errText = await res.text()
              console.error(`Custom provider error: ${errText}`)
              // Try non-streaming fallback
              const res2 = await fetch(chatUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  model: model.includes('/') ? model.split('/').pop() : model,
                  messages,
                  stream: false,
                  temperature: 0.7
                })
              })
              
              if (!res2.ok) {
                const err2 = await res2.text()
                throw new Error(`Custom provider (${provider}) error: ${err2}. URL: ${chatUrl}`)
              }
              
              const data = await res2.json()
              const text = data.choices?.[0]?.message?.content || data.content || JSON.stringify(data)
              fullResponse = text
              
              // Simulate streaming
              for (let i = 0; i < text.length; i += 5) {
                const chunk = text.slice(i, i + 5)
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
                await new Promise(r => setTimeout(r, 10))
              }
            } else {
              // Streaming response
              const reader = res.body?.getReader()
              const decoder = new TextDecoder()
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
                    const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.message?.content
                    if (delta) {
                      fullResponse += delta
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
                    }
                  } catch {}
                }
              }
            }
          }

          // Save messages to DB if conversationId provided
          if (conversationId) {
            try {
              await supabase.from('messages').insert({
                conversation_id: conversationId,
                user_id: user.id,
                role: 'assistant',
                content: fullResponse
              })
              
              await supabase.from('conversations').update({ 
                updated_at: new Date().toISOString(),
                provider,
                model_id: model,
                mode: mode || 'chat'
              }).eq('id', conversationId)
            } catch (e) {
              console.error('Failed to save message:', e)
            }
          }

          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        } catch (e: any) {
          console.error('Stream error:', e)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })

  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}
