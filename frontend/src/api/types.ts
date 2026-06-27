export type Provider = 'openrouter' | 'ollama'

export interface SettingsOut {
  provider: Provider
  has_key: boolean
  preferred_model: string
  ollama_base_url: string
}

export interface SettingsUpdate {
  provider?: Provider
  openrouter_api_key?: string
  preferred_model?: string
  ollama_base_url?: string
}

export interface ModelOption {
  id: string
  name: string
  context_length: number | null
}

export interface OutlineChapter {
  chapter_number: number
  title: string
  summary: string
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface Novel {
  id: string
  title: string
  premise: string
  inspiration: string
  book_outline: OutlineChapter[]
  premise_chat: ChatTurn[]
  outline_chat: ChatTurn[]
  rolling_summary: string
  created_at: string
  updated_at: string
}

export interface NovelCreate {
  title: string
  premise?: string
  inspiration?: string
}

export interface NovelUpdate {
  title?: string
  premise?: string
  inspiration?: string
}

export interface PremiseGenerateRequest {
  inspiration?: string
}

export interface PremiseProposal {
  premise: string
}

export interface OutlineGenerateRequest {
  chapter_count?: number
  user_direction?: string
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

export type ChapterStatus = 'planned' | 'drafted' | 'final'

export interface PlanBeat {
  title: string
  summary: string
}

export interface ChapterPlanContent {
  beats: PlanBeat[]
}

export interface Chapter {
  id: string
  novel_id: string
  chapter_number: number
  title: string
  status: ChapterStatus
  plan: ChapterPlanContent | null
  plan_approved_at: string | null
  prose: string
  user_direction: string
  relevant_entity_ids: string[]
  created_at: string
  updated_at: string
}

export interface ChapterCreate {
  chapter_number: number
  title?: string
  user_direction?: string
}

export interface ChapterUpdate {
  title?: string
  user_direction?: string
  relevant_entity_ids?: string[]
}

export interface PlanGenerateRequest {
  user_direction?: string
  relevant_entity_ids?: string[]
}

export interface ProseGenerateRequest {
  user_direction?: string
}

export interface ChapterRevision {
  id: string
  chapter_id: string
  content: string
  created_at: string
}
