import { api } from './client'
import type { Novel, OutlineChapter, OutlineGenerateRequest } from './types'

export const novelOutlineApi = {
  generate: (novelId: string, payload: OutlineGenerateRequest = {}) =>
    api.post<Novel>(`/novels/${novelId}/outline/generate`, payload),
  revise: (novelId: string, message: string) =>
    api.post<Novel>(`/novels/${novelId}/outline/revise`, { message }),
  update: (novelId: string, chapters: OutlineChapter[]) =>
    api.put<Novel>(`/novels/${novelId}/outline`, { chapters }),
  apply: (novelId: string) =>
    api.post<void>(`/novels/${novelId}/outline/apply`, {}),
}
