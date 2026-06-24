export interface SettingsOut {
  has_key: boolean
  preferred_model: string
}

export interface SettingsUpdate {
  openrouter_api_key?: string
  preferred_model?: string
}

export interface Novel {
  id: string
  title: string
  premise: string
  rolling_summary: string
  created_at: string
  updated_at: string
}

export interface NovelCreate {
  title: string
  premise?: string
}

export interface NovelUpdate {
  title?: string
  premise?: string
}

export type EntityType = 'character' | 'location' | 'storyline'

export interface Entity {
  id: string
  novel_id: string
  type: EntityType
  name: string
  fields: Record<string, unknown>
  description: string
  created_at: string
  updated_at: string
}

export interface EntityCreate {
  type: EntityType
  name: string
  fields?: Record<string, unknown>
  description?: string
}

export interface EntityUpdate {
  name?: string
  fields?: Record<string, unknown>
  description?: string
}

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  entity_id: string
  role: ChatRole
  content: string
  proposed_patch: { description?: string; fields?: Record<string, unknown> } | null
  applied: boolean
  created_at: string
}
