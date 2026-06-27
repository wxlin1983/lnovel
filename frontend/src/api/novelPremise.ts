import { api } from './client'
import type { Novel, PremiseGenerateRequest } from './types'

export const novelPremiseApi = {
  generate: (novelId: string, payload: PremiseGenerateRequest = {}) =>
    api.post<Novel>(`/novels/${novelId}/premise/generate`, payload),
  revise: (novelId: string, message: string) =>
    api.post<Novel>(`/novels/${novelId}/premise/revise`, { message }),
}
