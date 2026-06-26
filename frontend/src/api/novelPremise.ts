import { api } from './client'
import type { PremiseGenerateRequest, PremiseProposal } from './types'

export const novelPremiseApi = {
  generate: (novelId: string, payload: PremiseGenerateRequest = {}) =>
    api.post<PremiseProposal>(`/novels/${novelId}/premise/generate`, payload),
}
