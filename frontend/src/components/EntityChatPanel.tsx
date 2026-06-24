import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { entityChatApi } from '../api/entityChat'

interface EntityChatPanelProps {
  novelId: string
  entityId: string
}

export function EntityChatPanel({ novelId, entityId }: EntityChatPanelProps) {
  const queryClient = useQueryClient()
  const chatKey = ['entity-chat', entityId]

  const historyQuery = useQuery({
    queryKey: chatKey,
    queryFn: () => entityChatApi.list(novelId, entityId),
  })

  const [draft, setDraft] = useState('')
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
  const [streaming, setStreaming] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyPatchMutation = useMutation({
    mutationFn: (messageId: string) => entityChatApi.applyPatch(novelId, entityId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKey })
      queryClient.invalidateQueries({ queryKey: ['entities', novelId] })
    },
  })

  async function handleSend() {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    setPendingUserMessage(content)
    setStreaming('')
    setDraft('')

    try {
      await entityChatApi.send(novelId, entityId, content, {
        onDelta: (chunk) => setStreaming((s) => (s ?? '') + chunk),
        onDone: () => {
          queryClient.invalidateQueries({ queryKey: chatKey })
          setStreaming(null)
          setPendingUserMessage(null)
          setSending(false)
        },
        onError: (msg) => {
          setError(msg)
          setStreaming(null)
          setPendingUserMessage(null)
          setSending(false)
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStreaming(null)
      setPendingUserMessage(null)
      setSending(false)
    }
  }

  const messages = historyQuery.data ?? []

  return (
    <div className="space-y-3 rounded border bg-gray-50 p-3">
      <p className="text-sm font-medium text-gray-700">與 AI 討論此條目</p>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={`inline-block max-w-[85%] rounded px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white text-gray-800'
              }`}
            >
              {msg.content}
            </div>
            {msg.proposed_patch && (
              <div className="mt-1">
                {msg.applied ? (
                  <span className="text-xs text-green-600">已套用變更</span>
                ) : (
                  <button
                    className="rounded bg-green-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    disabled={applyPatchMutation.isPending}
                    onClick={() => applyPatchMutation.mutate(msg.id)}
                  >
                    套用變更建議
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {pendingUserMessage && (
          <div className="text-right">
            <div className="inline-block max-w-[85%] rounded bg-purple-600 px-3 py-2 text-sm whitespace-pre-wrap text-white">
              {pendingUserMessage}
            </div>
          </div>
        )}

        {streaming !== null && (
          <div className="text-left">
            <div className="inline-block max-w-[85%] rounded bg-white px-3 py-2 text-sm whitespace-pre-wrap text-gray-800">
              {streaming || '思考中...'}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <textarea
          className="flex-1 rounded border px-3 py-2 text-sm"
          rows={2}
          placeholder="輸入訊息，例如：請幫他補充一個會威脅到主角的秘密"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          className="rounded bg-purple-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={sending || !draft.trim()}
          onClick={handleSend}
        >
          送出
        </button>
      </div>
    </div>
  )
}
