import { api } from './client'
import type { ModelOption, Provider } from './types'

export const modelsApi = {
  list: (provider?: Provider) =>
    api.get<ModelOption[]>(provider ? `/models?provider=${provider}` : '/models'),
  // Only meant for an explicit "test connection" click, not live-typing — lets the
  // caller verify a candidate Ollama base URL before it's saved.
  test: (provider: Provider, ollamaBaseUrl?: string) => {
    const params = new URLSearchParams({ provider })
    if (ollamaBaseUrl) params.set('ollama_base_url', ollamaBaseUrl)
    return api.get<ModelOption[]>(`/models?${params.toString()}`)
  },
}
