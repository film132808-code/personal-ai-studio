import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt } from '@/lib/security/encryption'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider, apiKey, baseUrl, displayName, isCustom } = await req.json()

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API key required' }, { status: 400 })
    }

    // Normalize provider id
    const providerId = provider.toLowerCase().replace(/[^a-z0-9-]/g, '-')

    // Validate key server-side
    let valid = false
    let errorMsg = ''
    let modelsTested = 0

    try {
      if (providerId === 'openrouter' || provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/key', {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
        valid = res.ok
        if (!valid) errorMsg = 'Invalid OpenRouter key'
      } else if (providerId === 'gemini' || provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
        valid = res.ok
        if (!valid) errorMsg = 'Invalid Gemini key'
      } else if (providerId === 'groq' || provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` }
        })
        valid = res.ok
        if (!valid) errorMsg = 'Invalid Groq key'
      } else {
        // Custom provider - try OpenAI-compatible endpoints
        const testBaseUrl = baseUrl || `https://api.${providerId}.com/v1`
        const endpointsToTry = [
          `${testBaseUrl.replace(/\/$/, '')}/models`,
          `${testBaseUrl.replace(/\/$/, '')}/v1/models`,
          `https://api.inceptionlabs.ai/v1/models`,
          `https://api.unorouter.com/v1/models`,
          `https://api.openai.com/v1/models`
        ]

        // For custom, we try multiple ways
        for (const endpoint of [testBaseUrl.replace(/\/$/, '') + '/models', testBaseUrl]) {
          try {
            // Try with Bearer token
            const res = await fetch(endpoint, {
              headers: { 
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            })
            if (res.ok) {
              const data = await res.json()
              if (data.data || data.models || Array.isArray(data)) {
                valid = true
                modelsTested = data.data?.length || data.models?.length || 0
                break
              }
            }
            // Try with x-api-key header (Anthropic style)
            const res2 = await fetch(endpoint, {
              headers: { 
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
              }
            })
            if (res2.ok) {
              valid = true
              break
            }
          } catch (e) {
            continue
          }
        }

        // For custom providers, be lenient - if user provides key and baseUrl, allow it even if validation fails
        // They can still try to chat, and we'll show real error then
        if (!valid && isCustom) {
          // Allow custom providers to be saved even if models endpoint fails
          // Some providers don't have /models endpoint but have /chat/completions
          valid = true
          errorMsg = ''
        } else if (!valid) {
          errorMsg = `Could not validate custom provider. Tried: ${testBaseUrl}/models. Saving anyway for chat testing.`
          valid = isCustom ? true : false
        }
      }
    } catch (e: any) {
      errorMsg = e.message
      // For custom providers, allow save even on error
      if (isCustom) {
        valid = true
        errorMsg = ''
      } else {
        valid = false
      }
    }

    if (!valid) {
      return NextResponse.json({ valid: false, error: errorMsg }, { status: 400 })
    }

    // Encrypt and save
    const encrypted = encrypt(apiKey)

    // Try to save with new columns, fallback to old schema if columns don't exist
    let saveData: any = {
      user_id: user.id,
      provider: providerId,
      encrypted_api_key: encrypted,
      enabled: true,
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Add custom fields if provided
    if (baseUrl) saveData.base_url = baseUrl.replace(/\/$/, '')
    if (displayName) saveData.display_name = displayName
    if (isCustom) saveData.is_custom = true

    let { error: upsertError } = await supabase
      .from('provider_connections')
      .upsert(saveData, { onConflict: 'user_id,provider' })

    // If error due to missing columns (old schema), try without custom columns
    if (upsertError && (upsertError.message.includes('column') || upsertError.message.includes('base_url') || upsertError.message.includes('is_custom'))) {
      console.log('Old schema detected, saving without custom columns')
      const { base_url, display_name, is_custom, ...oldSaveData } = saveData
      const { error: retryError } = await supabase
        .from('provider_connections')
        .upsert(oldSaveData, { onConflict: 'user_id,provider' })
      upsertError = retryError
    }

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return NextResponse.json({ error: 'Failed to save key: ' + upsertError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      valid: true, 
      message: `Key validated and saved${modelsTested ? ` (${modelsTested} models found)` : ''}`,
      provider: providerId,
      isCustom: !!isCustom
    })

  } catch (e: any) {
    console.error('Validate error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('user_id', user.id)

    if (error) throw error

    // Don't expose encrypted keys, only metadata
    const safeData = (data || []).map((row: any) => ({
      provider: row.provider,
      display_name: row.display_name || row.provider,
      base_url: row.base_url || null,
      is_custom: row.is_custom || false,
      enabled: row.enabled,
      last_validated_at: row.last_validated_at,
      created_at: row.created_at
    }))

    return NextResponse.json({ connections: safeData })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider')

    if (!provider) {
      return NextResponse.json({ error: 'Provider required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('provider_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
