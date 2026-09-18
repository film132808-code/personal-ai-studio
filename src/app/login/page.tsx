"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Mail, Lock, ArrowRight, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/login'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Auth failed')
      }

      if (isSignUp) {
        if (data.session === 'exists') {
          setMessage("✅ Account তৈরি হয়েছে এবং Login হয়ে গেছে! Redirect হচ্ছে...")
          setTimeout(() => {
            router.push("/")
            router.refresh()
          }, 1000)
        } else {
          setMessage("✅ Account তৈরি হয়েছে! " + data.message + " এখন Login করো।")
          setIsSignUp(false)
        }
      } else {
        setMessage("✅ Login Successful! Redirect হচ্ছে...")
        // Force hard reload to ensure cookies are set
        setTimeout(() => {
          window.location.href = "/"
        }, 500)
      }
    } catch (err: any) {
      setMessage("❌ " + err.message)
      // If error is about email confirmation, give helpful message
      if (err.message.toLowerCase().includes('email not confirmed') || err.message.toLowerCase().includes('confirm')) {
        setMessage("❌ Email not confirmed! Supabase Dashboard → Authentication → Providers → Email → Confirm email OFF করো, তারপর নতুন Account বানাও।")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto shadow-lg shadow-violet-600/20 mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Personal AI Studio</h1>
          <p className="text-sm text-zinc-500 mt-2">তোমার প্রাইভেট AI Workspace - BYOK</p>
        </div>

        <div className="rounded-[20px] bg-white border border-zinc-200 shadow-xl p-6">
          <h2 className="font-semibold text-lg mb-1">{isSignUp ? "নতুন একাউন্ট" : "লগইন করো"}</h2>
          <p className="text-xs text-zinc-500 mb-6">
            {isSignUp ? "ইমেইল আর পাসওয়ার্ড দিয়ে একাউন্ট বানাও" : "তোমার Supabase একাউন্ট দিয়ে লগইন করো"}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1.5 block">ইমেইল</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">পাসওয়ার্ড</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-3 rounded-xl bg-zinc-50 border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>
            </div>

            {message && (
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-zinc-900 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>{isSignUp ? "একাউন্ট বানাও" : "লগইন"}</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-xs text-zinc-600 hover:text-zinc-900">
              {isSignUp ? "একাউন্ট আছে? লগইন করো" : "একাউন্ট নেই? নতুন বানাও"}
            </button>
          </div>

          <div className="mt-6 p-3 rounded-xl bg-violet-50 border border-violet-200">
            <p className="text-[11px] text-violet-800 leading-relaxed">
              💡 <strong>Fix for Login Loop:</strong> যদি Login হয়ে আবার Login পেজে ফিরে আসে, তাহলে Supabase Dashboard → Authentication → Providers → Email → <strong>Confirm email OFF</strong> করো।
            </p>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a href="/debug" className="text-xs text-zinc-400 hover:text-zinc-600 underline">Debug Page - Check Auth Status</a>
        </div>

        <p className="text-center text-[11px] text-zinc-400 mt-2">
          URL: https://tweswxbypqvjyfsunofd.supabase.co ✅ Connected
        </p>
      </div>
    </div>
  )
}
