"use client"

import { useState, useEffect, useRef } from "react"
import { 
  MessageSquare, Plus, Settings, Code2, Image as ImageIcon, Video, 
  Bot, Search, Sparkles, Send, Paperclip, MoreHorizontal,
  Trash2, Copy, Check, Sun, Moon, Zap, Brain, 
  LogOut, User, Key, Cpu, ChevronDown,
  X, Menu, StopCircle, Loader2, FileText, Upload
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

type AppMode = 'chat' | 'agent' | 'code' | 'image' | 'video'
type ProviderType = 'openrouter' | 'gemini' | 'groq' | string

interface Model {
  id: string
  provider: ProviderType
  displayName: string
  capabilities: any
  pricing?: any
  isFree?: boolean
  contextLength?: number
}

const MODE_CONFIG = {
  chat: { label: 'Chat', icon: MessageSquare, desc: 'General conversation', color: 'bg-blue-500', cap: 'chat' },
  agent: { label: 'Agent', icon: Bot, desc: 'Plan → Tools → Verify', color: 'bg-purple-500', cap: 'tools' },
  code: { label: 'Code', icon: Code2, desc: 'IDE workspace + Monaco', color: 'bg-emerald-500', cap: 'coding' },
  image: { label: 'Image', icon: ImageIcon, desc: 'Generate & Edit', color: 'bg-orange-500', cap: 'imageGeneration' },
  video: { label: 'Video', icon: Video, desc: 'Video generation', color: 'bg-pink-500', cap: 'videoGeneration' },
}

const FALLBACK_MODELS: Model[] = [
  { id: 'openai/gpt-4o', provider: 'openrouter', displayName: 'GPT-4o', capabilities: { chat: true, vision: true }, contextLength: 128000 },
  { id: 'google/gemini-2.0-flash-exp:free', provider: 'openrouter', displayName: 'Gemini 2.0 Flash (Free)', capabilities: { chat: true, vision: true }, isFree: true, contextLength: 1000000 },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', displayName: 'Llama 3.3 70B (Free)', capabilities: { chat: true, tools: true, coding: true }, isFree: true, contextLength: 128000 },
]

export default function ChatApp({ userEmail, userId }: { userEmail: string, userId?: string }) {
  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentMode, setCurrentMode] = useState<AppMode>('chat')
  const [selectedModel, setSelectedModel] = useState<Model>(FALLBACK_MODELS[0])
  const [models, setModels] = useState<Model[]>(FALLBACK_MODELS)
  const [filteredModels, setFilteredModels] = useState<Model[]>(FALLBACK_MODELS)
  const [showSettings, setShowSettings] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [messages, setMessages] = useState<Array<{id: string, role: 'user' | 'assistant', content: string, model?: string, attachments?: any[]}>>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [providers, setProviders] = useState<any[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [providerKeys, setProviderKeys] = useState({ openrouter: '', gemini: '', groq: '' })
  const [validating, setValidating] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showFreeOnly, setShowFreeOnly] = useState(true)
  const [modelSearch, setModelSearch] = useState("")
  const [customProviderForm, setCustomProviderForm] = useState({ id: '', name: '', baseUrl: '', apiKey: '' })
  const [showCustomProviderForm, setShowCustomProviderForm] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const router = useRouter()

  // Theme init
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initial = saved || (prefersDark ? 'dark' : 'light')
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch providers, models, conversations on mount
  useEffect(() => {
    fetchProviders()
    fetchModels()
    fetchConversations()
  }, [])

  // Filter models based on mode and free filter
  useEffect(() => {
    let filtered = [...models]
    
    // Filter by free if enabled
    if (showFreeOnly) {
      filtered = filtered.filter(m => m.isFree || m.pricing?.isFree)
    }
    
    // Filter by mode capability
    const cap = MODE_CONFIG[currentMode].cap
    if (cap) {
      filtered = filtered.filter(m => {
        if (cap === 'chat') return m.capabilities?.chat
        if (cap === 'tools') return m.capabilities?.tools
        if (cap === 'coding') return m.capabilities?.coding
        if (cap === 'imageGeneration') return m.capabilities?.imageGeneration
        if (cap === 'videoGeneration') return m.capabilities?.videoGeneration
        return true
      })
    }
    
    // Search filter
    if (modelSearch) {
      const search = modelSearch.toLowerCase()
      filtered = filtered.filter(m => 
        m.id.toLowerCase().includes(search) || 
        m.displayName.toLowerCase().includes(search)
      )
    }
    
    // If no models after filtering, show all free models
    if (filtered.length === 0 && showFreeOnly) {
      filtered = models.filter(m => m.isFree || m.pricing?.isFree)
    }
    
    setFilteredModels(filtered)
    // Auto-select first filtered model if current not in filtered
    if (filtered.length > 0 && !filtered.find(m => m.id === selectedModel.id)) {
      setSelectedModel(filtered[0])
    }
  }, [models, currentMode, showFreeOnly, modelSearch])

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(20)
      
      if (error) {
        console.error('Conversations fetch error:', error)
        return
      }
      if (data) {
        setConversations(data)
        // If no current conversation, select first or create new
        if (!currentConversationId && data.length > 0) {
          // Don't auto-select, let user choose or start new
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const createNewConversation = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          title: 'New Chat',
          mode: currentMode,
          provider: selectedModel.provider,
          model_id: selectedModel.id
        })
        .select()
        .single()
      
      if (error) throw error
      if (data) {
        setConversations(prev => [data, ...prev])
        setCurrentConversationId(data.id)
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `নতুন চ্যাট শুরু হলো! Mode: **${MODE_CONFIG[currentMode].label}** | Model: **${selectedModel.displayName}**\n\nকি নিয়ে আলোচনা করবে?`,
          model: 'system'
        }])
      }
    } catch (e: any) {
      console.error('Create conversation error:', e)
      // Fallback to local
      const newId = Date.now().toString()
      setCurrentConversationId(newId)
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `নতুন চ্যাট (Local) - Mode: ${MODE_CONFIG[currentMode].label}`,
        model: 'system'
      }])
    }
  }

  const loadConversation = async (convId: string) => {
    setCurrentConversationId(convId)
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      if (data) {
        setMessages(data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          model: m.model_id || undefined,
          attachments: m.attachments_json || []
        })))
      }
    } catch (e) {
      console.error('Load messages error:', e)
    }
  }

  const deleteConversation = async (convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!confirm('Delete this conversation?')) return
    try {
      await supabase.from('conversations').delete().eq('id', convId)
      setConversations(prev => prev.filter(c => c.id !== convId))
      if (currentConversationId === convId) {
        setCurrentConversationId(null)
        setMessages([])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers/validate')
      const data = await res.json()
      if (data.error) {
        console.error('Providers error:', data.error)
        if (data.error.includes('does not exist') || data.error.includes('relation')) {
          setErrorMsg('⚠️ Database tables missing! Please run supabase-migration-fixed.sql')
        }
        return
      }
      if (data.connections) setProviders(data.connections)
    } catch (e: any) {
      setErrorMsg('Failed to fetch providers: ' + e.message)
    }
  }

  const fetchModels = async () => {
    setLoadingModels(true)
    try {
      const res = await fetch('/api/models')
      const data = await res.json()
      if (data.error) {
        console.error('Models error:', data.error)
        return
      }
      if (data.models && data.models.length > 0) {
        const normalized = data.models.map((m: any) => ({
          id: m.id,
          provider: m.provider,
          displayName: m.displayName,
          capabilities: m.capabilities,
          pricing: m.pricing,
          isFree: m.pricing?.isFree,
          contextLength: m.contextLength
        }))
        setModels(normalized)
      }
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoadingModels(false)
    }
  }

  const handleValidateKey = async (provider: ProviderType) => {
    const key = providerKeys[provider as keyof typeof providerKeys]
    if (!key?.trim()) return
    setValidating(provider)
    try {
      const res = await fetch('/api/providers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key })
      })
      const data = await res.json()
      if (data.valid) {
        alert(`✅ ${provider} Connected!`)
        setProviderKeys({ ...providerKeys, [provider]: '' })
        fetchProviders()
        fetchModels()
      } else {
        alert(`❌ Failed: ${data.error}`)
      }
    } catch (e: any) {
      alert(`❌ Error: ${e.message}`)
    } finally {
      setValidating(null)
    }
  }

  const handleCustomProvider = async () => {
    if (!customProviderForm.id || !customProviderForm.apiKey || !customProviderForm.baseUrl) {
      alert('Please fill all fields')
      return
    }
    setValidating('custom')
    try {
      // For custom provider, we try OpenAI-compatible /v1/models
      const res = await fetch('/api/providers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          provider: customProviderForm.id.toLowerCase().replace(/\s+/g, '-'),
          apiKey: customProviderForm.apiKey,
          baseUrl: customProviderForm.baseUrl,
          isCustom: true,
          displayName: customProviderForm.name
        })
      })
      const data = await res.json()
      if (data.valid || res.ok) {
        alert(`✅ Custom Provider ${customProviderForm.name} Connected!`)
        setCustomProviderForm({ id: '', name: '', baseUrl: '', apiKey: '' })
        setShowCustomProviderForm(false)
        fetchProviders()
        fetchModels()
      } else {
        // Even if validation fails, save as custom (user knows best)
        alert(`⚠️ Validation warning: ${data.error}, but saved as custom provider`)
        setShowCustomProviderForm(false)
      }
    } catch (e: any) {
      alert(`❌ Error: ${e.message}`)
    } finally {
      setValidating(null)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setUploadingFile(true)
    try {
      const user = (await supabase.auth.getUser()).data.user
      if (!user) throw new Error('Not authenticated')
      
      const uploaded: any[] = []
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} too large (max 10MB)`)
          continue
        }
        
        const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(fileName, file)
        
        if (error) throw error
        
        const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(fileName)
        
        uploaded.push({
          name: file.name,
          size: file.size,
          type: file.type,
          path: fileName,
          url: publicUrl
        })
      }
      
      setAttachedFiles(prev => [...prev, ...uploaded])
    } catch (err: any) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSend = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isGenerating) return
    
    if (providers.length === 0) {
      setShowSettings(true)
      return
    }

    // Create conversation if none
    let convId = currentConversationId
    if (!convId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data, error } = await supabase
          .from('conversations')
          .insert({
            user_id: user?.id,
            title: input.slice(0, 50) || 'New Chat',
            mode: currentMode,
            provider: selectedModel.provider,
            model_id: selectedModel.id
          })
          .select()
          .single()
        if (!error && data) {
          convId = data.id
          setCurrentConversationId(data.id)
          setConversations(prev => [data, ...prev])
        }
      } catch (e) {
        convId = Date.now().toString()
        setCurrentConversationId(convId)
      }
    }

    const userMessage = { 
      id: Date.now().toString(), 
      role: 'user' as const, 
      content: input + (attachedFiles.length > 0 ? `\n\n[Attached: ${attachedFiles.map(f => f.name).join(', ')}]` : ''),
      attachments: [...attachedFiles]
    }
    setMessages(prev => [...prev, userMessage])
    
    // Save user message to DB
    if (convId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('messages').insert({
          conversation_id: convId,
          user_id: user?.id,
          role: 'user',
          content: userMessage.content,
          attachments_json: attachedFiles
        })
        // Update conversation title if first message
        if (messages.length <= 1) {
          await supabase.from('conversations').update({ 
            title: input.slice(0, 50),
            updated_at: new Date().toISOString()
          }).eq('id', convId)
          fetchConversations()
        }
      } catch (e) {
        console.error('Save user message error:', e)
      }
    }
    
    setInput("")
    setAttachedFiles([])
    setIsGenerating(true)

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', model: selectedModel.displayName }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages.filter(m => (m as any).model !== 'system'), userMessage].map(m => ({ role: m.role, content: m.content })),
          model: selectedModel.id,
          provider: selectedModel.provider,
          conversationId: convId,
          mode: currentMode
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Chat failed')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') break
              try {
                const json = JSON.parse(data)
                if (json.content) {
                  full += json.content
                  setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: full } : m))
                }
                if (json.error) throw new Error(json.error)
              } catch {}
            }
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `❌ Error: ${e.message}\n\nSettings এ গিয়ে API Key চেক করো।` } : m))
    } finally {
      setIsGenerating(false)
    }
  }

  const copyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <div className={`flex h-screen overflow-hidden ${theme === 'dark' ? 'dark bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'}`}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-[300px]' : 'w-0'} transition-all duration-300 border-r ${theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50/80'} backdrop-blur-xl flex flex-col overflow-hidden`}>
        <div className={`p-4 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-[15px] leading-none tracking-tight">Personal AI Studio</h1>
                <p className={`text-[11px] mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>BYOK • {providers.length} Providers • {theme}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={toggleTheme} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={() => setSidebarOpen(false)} className={`lg:hidden p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <button onClick={createNewConversation} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-medium text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className={`p-3 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 px-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Modes</p>
          <div className="space-y-1">
            {Object.entries(MODE_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              const isActive = currentMode === key
              return (
                <button
                  key={key}
                  onClick={() => setCurrentMode(key as AppMode)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? `${theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-zinc-50' : 'bg-white border-zinc-200 text-zinc-900'} shadow-sm border` 
                      : `${theme === 'dark' ? 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'}`
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg ${config.color} flex items-center justify-center`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="leading-none">{config.label}</div>
                    <div className={`text-[11px] mt-1 leading-none ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{config.desc}</div>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2.5 px-2">
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>History ({conversations.length})</p>
            <button className={`p-1 rounded-md ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>
              <Search className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>
          <div className="space-y-1">
            {conversations.length === 0 ? (
              <p className={`text-xs px-3 py-2 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>No history yet. Start a new chat!</p>
            ) : conversations.map(conv => {
              const ModeIcon = MODE_CONFIG[conv.mode as AppMode]?.icon || MessageSquare
              const isActive = currentConversationId === conv.id
              return (
                <div key={conv.id} onClick={() => loadConversation(conv.id)} className={`group flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${isActive ? (theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200 shadow-sm') : `border-transparent ${theme === 'dark' ? 'hover:bg-zinc-800 hover:border-zinc-700' : 'hover:bg-white hover:border-zinc-200 hover:shadow-sm'}`}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${theme === 'dark' ? 'bg-zinc-800 group-hover:bg-zinc-700' : 'bg-zinc-100 group-hover:bg-zinc-900'} transition-colors`}>
                    <ModeIcon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-zinc-400 group-hover:text-zinc-100' : 'text-zinc-600 group-hover:text-white'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium leading-[1.3] truncate">{conv.title}</p>
                    <p className={`text-[11px] mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{new Date(conv.updated_at).toLocaleDateString()} • {MODE_CONFIG[conv.mode as AppMode]?.label || conv.mode}</p>
                  </div>
                  <button onClick={(e) => deleteConversation(conv.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-all">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              )
            })}
          </div>

          {providers.length === 0 ? (
            <div className={`mt-6 p-3 rounded-xl border ${theme === 'dark' ? 'bg-violet-950/20 border-violet-800/30' : 'bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-200/50'}`}>
              <p className="text-xs font-semibold">BYOK Setup Required</p>
              <p className={`text-[11px] leading-relaxed mb-3 mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>API Key যোগ করো। OpenRouter এ অনেক Free মডেল আছে।</p>
              <button onClick={() => setShowSettings(true)} className="w-full h-8 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-xs font-medium">Add API Keys</button>
            </div>
          ) : (
            <div className={`mt-6 p-3 rounded-xl border ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className={`text-xs font-semibold flex items-center gap-2 ${theme === 'dark' ? 'text-emerald-200' : 'text-emerald-800'}`}><Check className="w-4 h-4" />{providers.length} Provider • {models.length} Models</p>
              <p className={`text-[11px] mt-1 ${theme === 'dark' ? 'text-emerald-300/80' : 'text-emerald-700'}`}>{providers.map((p: any) => p.provider).join(', ')}</p>
            </div>
          )}
        </div>

        <div className={`p-3 border-t ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border shadow-sm ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-white border-zinc-200'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center">
              <User className="w-4 h-4 text-white dark:text-zinc-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium leading-none truncate">{userEmail}</p>
              <p className={`text-[11px] mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{providers.length} providers • Private</p>
            </div>
            <button onClick={handleLogout} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-zinc-700' : 'hover:bg-zinc-100'}`}>
              <LogOut className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${theme === 'dark' ? 'bg-zinc-950' : 'bg-white'}`}>
        {/* Top Bar */}
        <div className={`h-[64px] border-b flex items-center justify-between px-4 backdrop-blur-xl sticky top-0 z-10 ${theme === 'dark' ? 'border-zinc-800 bg-zinc-950/80' : 'border-zinc-200 bg-white/80'}`}>
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className={`p-2 rounded-xl ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl ${MODE_CONFIG[currentMode].color} flex items-center justify-center shadow-sm`}>
                {(() => {
                  const Icon = MODE_CONFIG[currentMode].icon
                  return <Icon className="w-4 h-4 text-white" />
                })()}
              </div>
              <div>
                <h2 className="font-semibold text-[15px] leading-none flex items-center gap-2">
                  {MODE_CONFIG[currentMode].label} Mode
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-medium">LIVE</span>
                </h2>
                <p className={`text-xs mt-1 hidden sm:block ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{MODE_CONFIG[currentMode].desc} • {theme} mode</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className={`w-9 h-9 rounded-xl border flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'}`}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setShowModelSelector(!showModelSelector)}
                className={`flex items-center gap-2.5 h-9 px-3 pr-2 rounded-xl border text-sm ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'}`}
              >
                <div className="w-6 h-6 rounded-lg bg-zinc-900 dark:bg-zinc-50 flex items-center justify-center">
                  <Cpu className="w-3 h-3 text-white dark:text-zinc-900" />
                </div>
                <div className="text-left hidden sm:block">
                  <div className="font-medium text-[13px] leading-none max-w-[140px] truncate">{selectedModel.displayName}</div>
                  <div className={`text-[10px] leading-none mt-1 flex items-center gap-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {selectedModel.provider}
                    {selectedModel.isFree && <span className="px-1 py-0 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">FREE</span>}
                    {loadingModels && <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
              </button>

              {showModelSelector && (
                <div className={`absolute top-full mt-2 right-0 w-[400px] rounded-2xl border shadow-xl overflow-hidden z-50 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                  <div className={`p-3 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">Models - {filteredModels.length}/{models.length}</h3>
                      <button onClick={fetchModels} className={`text-xs px-2 py-1 rounded-full ${theme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700' : 'bg-zinc-100 hover:bg-zinc-200'}`}>Refresh</button>
                    </div>
                    <div className="mt-3 space-y-2">
                      <input
                        placeholder="Search models..."
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        className={`w-full h-8 px-3 rounded-lg border text-sm ${theme === 'dark' ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}
                      />
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={showFreeOnly} onChange={(e) => setShowFreeOnly(e.target.checked)} className="rounded" />
                          Free only
                        </label>
                        <span className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>• {MODE_CONFIG[currentMode].label} mode filter active</span>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[320px] overflow-y-auto p-2">
                    {filteredModels.map(model => (
                      <button
                        key={`${model.provider}-${model.id}`}
                        onClick={() => { setSelectedModel(model); setShowModelSelector(false) }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${selectedModel.id === model.id ? (theme === 'dark' ? 'bg-zinc-800 border border-zinc-700' : 'bg-zinc-50 border border-zinc-200') : 'border border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center flex-shrink-0">
                          <Brain className="w-4 h-4 text-white dark:text-zinc-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-[13px] truncate">{model.displayName}</p>
                            {model.isFree && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-medium">FREE</span>}
                          </div>
                          <p className={`text-xs truncate ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{model.id}</p>
                        </div>
                        {selectedModel.id === model.id && <Check className="w-4 h-4 text-emerald-600" />}
                      </button>
                    ))}
                    {filteredModels.length === 0 && (
                      <p className={`text-xs text-center py-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>No models found. Try disabling Free only filter.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setShowSettings(true)} className={`w-9 h-9 rounded-xl border flex items-center justify-center ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800' : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'}`}>
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="mx-4 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            <p className="font-semibold">⚠️ Error:</p>
            <p className="mt-1">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="mt-2 text-xs underline">Dismiss</button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full px-4 py-8">
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-lg">Welcome to Personal AI Studio</h3>
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Start a new chat or select from history</p>
                <button onClick={createNewConversation} className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm">New Chat</button>
              </div>
            ) : messages.map((msg) => (
              <div key={msg.id} className={`group flex gap-4 mb-8 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-zinc-900 dark:bg-zinc-50' : 'bg-gradient-to-br from-violet-600 to-indigo-600'}`}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-white dark:text-zinc-900" /> : <Sparkles className="w-4 h-4 text-white" />}
                </div>
                <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className={`relative rounded-2xl px-4 py-3 max-w-[85%] ${msg.role === 'user' ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-br-md' : `${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'} border rounded-bl-md`}`}>
                    {msg.role === 'assistant' && (msg as any).model && (msg as any).model !== 'system' && (
                      <div className={`flex items-center gap-2 mb-2 text-[11px] ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        <Cpu className="w-3 h-3" />
                        {(msg as any).model}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-[14px] leading-[1.6] break-words">
                      {msg.content || (isGenerating && msg.id === messages[messages.length-1]?.id ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
                        </span>
                      ) : '')}
                    </div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {msg.attachments.map((f: any, i: number) => (
                          <div key={i} className={`text-xs p-2 rounded-lg flex items-center gap-2 ${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                            <FileText className="w-4 h-4" />
                            <span className="truncate">{f.name}</span>
                            <a href={f.url} target="_blank" className="text-blue-500 underline ml-auto">View</a>
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.role === 'assistant' && msg.content && (
                      <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => copyMessage(msg.id, msg.content)} className={`p-1.5 rounded-lg ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className={`border-t backdrop-blur-xl p-4 ${theme === 'dark' ? 'border-zinc-800 bg-zinc-950/80' : 'border-zinc-200 bg-white/80'}`}>
          <div className="max-w-3xl mx-auto">
            {/* Attached files preview */}
            {attachedFiles.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachedFiles.map((f, i) => (
                  <div key={i} className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                    <FileText className="w-3 h-3" />
                    {f.name}
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-none">
              {Object.entries(MODE_CONFIG).map(([key, config]) => {
                const Icon = config.icon
                const isActive = currentMode === key
                return (
                  <button
                    key={key}
                    onClick={() => setCurrentMode(key as AppMode)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all ${
                      isActive
                        ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-50 shadow-sm'
                        : `${theme === 'dark' ? 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800' : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100'}`
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </button>
                )
              })}
              <div className={`flex items-center gap-1.5 ml-2 pl-2 border-l ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
                <div className={`w-2 h-2 rounded-full ${providers.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{providers.length > 0 ? 'Connected' : 'Add API Key'}</span>
              </div>
            </div>

            <div className={`relative flex items-end gap-2 p-2 rounded-[20px] border shadow-sm focus-within:shadow-md transition-all ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 focus-within:border-zinc-700' : 'bg-zinc-50 border-zinc-200 focus-within:border-zinc-300'}`}>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.ts,.py,.html,.css" />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'}`}>
                {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin text-zinc-500" /> : <Paperclip className="w-5 h-5 text-zinc-500" />}
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder={
                  providers.length === 0 ? 'প্রথমে Settings এ API Key যোগ করো...' :
                  currentMode === 'code' ? 'কোড নিয়ে প্রশ্ন করো...' :
                  currentMode === 'agent' ? 'Agent কে টাস্ক দাও...' :
                  'মেসেজ লিখো... বাংলায় বা ইংরেজিতে'
                }
                className={`flex-1 min-h-[44px] max-h-[160px] bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-[14px] leading-[1.5] py-3 placeholder:text-zinc-500`}
                rows={1}
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                {isGenerating ? (
                  <button onClick={() => setIsGenerating(false)} className="w-9 h-9 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-sm">
                    <StopCircle className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={(!input.trim() && attachedFiles.length === 0) || isGenerating}
                    className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 px-1">
              <p className={`text-[11px] flex items-center gap-1.5 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                <Zap className="w-3 h-3" />
                {selectedModel.displayName} • {currentMode} mode • {attachedFiles.length > 0 ? `${attachedFiles.length} files •` : ''} Encrypted
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-[20px] border shadow-2xl overflow-hidden flex flex-col ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className={`flex items-center justify-between p-6 border-b ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-50 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-white dark:text-zinc-900" />
                </div>
                <div>
                  <h2 className="font-semibold text-[16px]">Settings - BYOK</h2>
                  <p className={`text-xs ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{userEmail} • {providers.length} connected • {theme} theme</p>
                </div>
              </div>
              <button onClick={() => setShowSettings(false)} className={`w-8 h-8 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  AI Providers - Real API Integration
                </h3>
                <div className="space-y-3">
                  {[
                    { id: 'openrouter', name: 'OpenRouter', desc: 'সবচেয়ে ভালো - 100+ মডেল, অনেক Free', placeholder: 'sk-or-v1-...', link: 'openrouter.ai/keys' },
                    { id: 'gemini', name: 'Google Gemini', desc: 'Google এর মডেল - সরাসরি API', placeholder: 'AIza...', link: 'aistudio.google.com/app/apikey' },
                    { id: 'groq', name: 'Groq', desc: 'সবচেয়ে ফাস্ট - Llama মডেল', placeholder: 'gsk_...', link: 'console.groq.com/keys' },
                  ].map(provider => {
                    const isConnected = providers.some((p: any) => p.provider === provider.id)
                    return (
                      <div key={provider.id} className={`p-4 rounded-xl border ${isConnected ? (theme === 'dark' ? 'border-emerald-800 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50/50') : (theme === 'dark' ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50/50')} `}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium text-sm flex items-center gap-2">
                              {provider.name}
                              {isConnected && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white">Connected</span>}
                            </p>
                            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{provider.desc}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            value={providerKeys[provider.id as keyof typeof providerKeys]}
                            onChange={(e) => setProviderKeys({ ...providerKeys, [provider.id]: e.target.value })}
                            placeholder={provider.placeholder}
                            className={`flex-1 h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800 focus:ring-zinc-50' : 'bg-white border-zinc-200 focus:ring-zinc-900'}`}
                          />
                          <button 
                            onClick={() => handleValidateKey(provider.id as ProviderType)}
                            disabled={validating === provider.id || !providerKeys[provider.id as keyof typeof providerKeys]}
                            className="h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center gap-2"
                          >
                            {validating === provider.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Validate
                          </button>
                        </div>
                        <p className={`text-[11px] mt-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Get key from: {provider.link}</p>
                      </div>
                    )
                  })}

                  {/* Custom Provider Section */}
                  <div className={`p-4 rounded-xl border-2 border-dashed ${theme === 'dark' ? 'border-zinc-700 bg-zinc-900/50' : 'border-zinc-300 bg-zinc-50/50'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Custom Provider (Claude Code Style)
                        </p>
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Add any OpenAI-compatible API (Anthropic Claude, Together AI, etc.)</p>
                      </div>
                      <button onClick={() => setShowCustomProviderForm(!showCustomProviderForm)} className="text-xs px-3 py-1 rounded-full bg-zinc-900 text-white">
                        {showCustomProviderForm ? 'Cancel' : 'Add Custom'}
                      </button>
                    </div>
                    
                    {showCustomProviderForm && (
                      <div className="space-y-3 mt-3">
                        <input
                          placeholder="Provider ID (e.g., claude, together)"
                          value={customProviderForm.id}
                          onChange={(e) => setCustomProviderForm({ ...customProviderForm, id: e.target.value })}
                          className={`w-full h-9 px-3 rounded-xl border text-sm ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}
                        />
                        <input
                          placeholder="Display Name (e.g., Claude 3.5 Sonnet)"
                          value={customProviderForm.name}
                          onChange={(e) => setCustomProviderForm({ ...customProviderForm, name: e.target.value })}
                          className={`w-full h-9 px-3 rounded-xl border text-sm ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}
                        />
                        <input
                          placeholder="Base URL (e.g., https://api.anthropic.com/v1)"
                          value={customProviderForm.baseUrl}
                          onChange={(e) => setCustomProviderForm({ ...customProviderForm, baseUrl: e.target.value })}
                          className={`w-full h-9 px-3 rounded-xl border text-sm ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}
                        />
                        <div className="flex gap-2">
                          <input
                            placeholder="API Key"
                            value={customProviderForm.apiKey}
                            onChange={(e) => setCustomProviderForm({ ...customProviderForm, apiKey: e.target.value })}
                            className={`flex-1 h-9 px-3 rounded-xl border text-sm ${theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'}`}
                          />
                          <button onClick={handleCustomProvider} disabled={validating === 'custom'} className="h-9 px-4 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                            {validating === 'custom' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`rounded-xl border p-4 ${theme === 'dark' ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-50 border-zinc-200'}`}>
                <h4 className="font-medium text-xs mb-2">🔒 Security Info</h4>
                <p className={`text-[11px] leading-relaxed ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  API Keys AES-256-GCM এনক্রিপ্ট হয়ে Supabase এ সেভ হয়। RLS এর জন্য শুধু তুমিই দেখতে পারো।
                </p>
              </div>
            </div>

            <div className={`p-4 border-t flex justify-between items-center ${theme === 'dark' ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50/50'}`}>
              <button onClick={fetchModels} className={`h-9 px-4 rounded-xl border text-sm font-medium flex items-center gap-2 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
                <Cpu className="w-4 h-4" />
                Refresh Models
              </button>
              <button onClick={() => setShowSettings(false)} className="h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
