import { fetchEventSource } from '@microsoft/fetch-event-source'
import { api, ApiError } from './client'
import type { ChatMessage, Entity } from './types'

function chatBasePath(novelId: string, entityId: string): string {
  return `/novels/${novelId}/entities/${entityId}/chat`
}

export const entityChatApi = {
  list: (novelId: string, entityId: string) =>
    api.get<ChatMessage[]>(chatBasePath(novelId, entityId)),

  applyPatch: (novelId: string, entityId: string, messageId: string) =>
    api.post<Entity>(`${chatBasePath(novelId, entityId)}/${messageId}/apply-patch`),

  send: (
    novelId: string,
    entityId: string,
    content: string,
    handlers: {
      onDelta: (chunk: string) => void
      onDone: (result: { message_id: string; content: string; proposed_patch: ChatMessage['proposed_patch'] }) => void
      onError: (message: string) => void
    },
    signal?: AbortSignal,
  ): Promise<void> =>
    fetchEventSource(`/api${chatBasePath(novelId, entityId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal,
      async onopen(response) {
        if (!response.ok) {
          const body = await response.text()
          throw new ApiError(response.status, body || response.statusText)
        }
      },
      onmessage(msg) {
        if (msg.event === 'delta') {
          handlers.onDelta(msg.data)
        } else if (msg.event === 'done') {
          handlers.onDone(JSON.parse(msg.data))
        } else if (msg.event === 'error') {
          handlers.onError(msg.data)
        }
      },
      onerror(err) {
        handlers.onError(err instanceof Error ? err.message : String(err))
        throw err
      },
    }),
}
