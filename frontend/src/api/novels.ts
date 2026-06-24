import { api } from './client'
import type { Novel, NovelCreate, NovelUpdate } from './types'

export const novelsApi = {
  list: () => api.get<Novel[]>('/novels'),
  get: (id: string) => api.get<Novel>(`/novels/${id}`),
  create: (payload: NovelCreate) => api.post<Novel>('/novels', payload),
  update: (id: string, payload: NovelUpdate) => api.put<Novel>(`/novels/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/novels/${id}`),
}
