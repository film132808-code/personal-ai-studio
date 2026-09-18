export type AppMode = 'chat' | 'agent' | 'code' | 'image' | 'video' | 'research'

export type ProviderType = 'openrouter' | 'gemini' | 'groq'

export interface ModelCapabilities {
  chat: boolean
  vision: boolean
  tools: boolean
  coding: boolean
  reasoning: boolean
  imageGeneration: boolean
  imageEditing: boolean
  videoGeneration: boolean
  audio: boolean
}

export interface ModelPricing {
  input?: number
  output?: number
  image?: number
  video?: number
  isFree?: boolean
  isFreeConfirmed?: boolean
}

export interface NormalizedModel {
  id: string
  provider: ProviderType
  displayName: string
  contextLength?: number
  capabilities: ModelCapabilities
  pricing: ModelPricing
  metadata?: Record<string, any>
  lastChecked?: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  mode: AppMode
  provider: ProviderType
  model_id: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  attachments?: any[]
  tool_calls?: any[]
  created_at: string
}

export interface ProviderConnection {
  id: string
  user_id: string
  provider: ProviderType
  enabled: boolean
  last_validated_at?: string
  created_at: string
}
