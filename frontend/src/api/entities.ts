import { api } from './client'
import type { Entity, EntityCreate, EntityUpdate, EntityType } from './types'

export const entitiesApi = {
  list: (novelId: string, type?: EntityType) =>
    api.get<Entity[]>(`/novels/${novelId}/entities${type ? `?type=${type}` : ''}`),
  get: (novelId: string, entityId: string) =>
    api.get<Entity>(`/novels/${novelId}/entities/${entityId}`),
  create: (novelId: string, payload: EntityCreate) =>
    api.post<Entity>(`/novels/${novelId}/entities`, payload),
  update: (novelId: string, entityId: string, payload: EntityUpdate) =>
    api.put<Entity>(`/novels/${novelId}/entities/${entityId}`, payload),
  remove: (novelId: string, entityId: string) =>
    api.delete<void>(`/novels/${novelId}/entities/${entityId}`),
}
