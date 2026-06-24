import { api } from './client'
import type { Chapter, ChapterCreate, ChapterUpdate } from './types'

export const chaptersApi = {
  list: (novelId: string) => api.get<Chapter[]>(`/novels/${novelId}/chapters`),
  get: (novelId: string, chapterId: string) => api.get<Chapter>(`/novels/${novelId}/chapters/${chapterId}`),
  create: (novelId: string, payload: ChapterCreate) =>
    api.post<Chapter>(`/novels/${novelId}/chapters`, payload),
  update: (novelId: string, chapterId: string, payload: ChapterUpdate) =>
    api.put<Chapter>(`/novels/${novelId}/chapters/${chapterId}`, payload),
  remove: (novelId: string, chapterId: string) =>
    api.delete<void>(`/novels/${novelId}/chapters/${chapterId}`),
}
