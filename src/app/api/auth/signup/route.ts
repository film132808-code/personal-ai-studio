import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const supabase = await createClient()
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${req.nextUrl.origin}/auth/callback`
      }
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // If user is created but needs confirmation, data.user exists but session may be null
    // If email confirmation is OFF, session will exist
    return NextResponse.json({ 
      success: true, 
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
      session: data.session ? 'exists' : 'no-session (email confirmation may be ON)',
      message: data.session ? 'Account created and logged in' : 'Account created - please check if email confirmation is OFF in Supabase, then login'
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
