import { api } from './client'
import type { Novel, OutlineChapter, OutlineGenerateRequest } from './types'

export const novelOutlineApi = {
  generate: (novelId: string, payload: OutlineGenerateRequest = {}) =>
    api.post<Novel>(`/novels/${novelId}/outline/generate`, payload),
  update: (novelId: string, chapters: OutlineChapter[]) =>
    api.put<Novel>(`/novels/${novelId}/outline`, { chapters }),
}
