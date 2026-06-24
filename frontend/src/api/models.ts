import { api } from './client'
import type { ModelOption, Provider } from './types'

export const modelsApi = {
  list: (provider?: Provider) =>
    api.get<ModelOption[]>(provider ? `/models?provider=${provider}` : '/models'),
}
