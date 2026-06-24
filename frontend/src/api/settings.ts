import { api } from './client'
import type { SettingsOut, SettingsUpdate } from './types'

export const settingsApi = {
  get: () => api.get<SettingsOut>('/settings'),
  update: (payload: SettingsUpdate) => api.put<SettingsOut>('/settings', payload),
}
