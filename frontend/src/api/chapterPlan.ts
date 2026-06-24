import { api } from './client'
import type { Chapter, ChapterPlanContent, PlanGenerateRequest } from './types'

function planPath(novelId: string, chapterId: string): string {
  return `/novels/${novelId}/chapters/${chapterId}/plan`
}

export const chapterPlanApi = {
  generate: (novelId: string, chapterId: string, payload: PlanGenerateRequest = {}) =>
    api.post<Chapter>(planPath(novelId, chapterId), payload),
  regenerate: (novelId: string, chapterId: string, payload: PlanGenerateRequest = {}) =>
    api.post<Chapter>(`${planPath(novelId, chapterId)}/regenerate`, payload),
  update: (novelId: string, chapterId: string, plan: ChapterPlanContent) =>
    api.put<Chapter>(planPath(novelId, chapterId), { plan }),
  approve: (novelId: string, chapterId: string) =>
    api.post<Chapter>(`${planPath(novelId, chapterId)}/approve`),
}
