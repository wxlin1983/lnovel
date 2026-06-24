import { fetchEventSource } from '@microsoft/fetch-event-source'
import { api, ApiError } from './client'
import type { Chapter, ChapterRevision } from './types'

function prosePath(novelId: string, chapterId: string): string {
  return `/novels/${novelId}/chapters/${chapterId}/prose`
}

export const chapterProseApi = {
  update: (novelId: string, chapterId: string, prose: string) =>
    api.put<Chapter>(prosePath(novelId, chapterId), { prose }),
  finalize: (novelId: string, chapterId: string) =>
    api.post<Chapter>(`${prosePath(novelId, chapterId)}/finalize`),
  listRevisions: (novelId: string, chapterId: string) =>
    api.get<ChapterRevision[]>(`${prosePath(novelId, chapterId)}/revisions`),

  generate: (
    novelId: string,
    chapterId: string,
    regenerate: boolean,
    handlers: {
      onDelta: (chunk: string) => void
      onDone: (prose: string) => void
      onError: (message: string) => void
    },
    signal?: AbortSignal,
  ): Promise<void> =>
    fetchEventSource(`/api${prosePath(novelId, chapterId)}${regenerate ? '/regenerate' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
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
          handlers.onDone(JSON.parse(msg.data).prose)
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
