import { api } from './client'
import type { FreeModel } from './types'

export const modelsApi = {
  listFree: () => api.get<FreeModel[]>('/models/free'),
}
