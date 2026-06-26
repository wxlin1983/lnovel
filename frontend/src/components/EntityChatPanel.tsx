import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { entityChatApi } from '../api/entityChat'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

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
  const abortRef = useRef<AbortController | null>(null)

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
    const controller = new AbortController()
    abortRef.current = controller
    setSending(true)
    setError(null)
    setPendingUserMessage(content)
    setStreaming('')
    setDraft('')

    try {
      await entityChatApi.send(
        novelId,
        entityId,
        content,
        {
          onDelta: (chunk) => setStreaming((s) => (s ?? '') + chunk),
          onDone: () => {
            queryClient.invalidateQueries({ queryKey: chatKey })
            setStreaming(null)
            setPendingUserMessage(null)
            setSending(false)
          },
          onError: (msg) => {
            if (!controller.signal.aborted) setError(msg)
            setStreaming(null)
            setPendingUserMessage(null)
            setSending(false)
          },
        },
        controller.signal,
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err))
      }
      setStreaming(null)
      setPendingUserMessage(null)
      setSending(false)
    } finally {
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  const messages = historyQuery.data ?? []

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
      <p className="text-sm font-medium text-foreground">與 AI 討論此條目</p>

      <div className="max-h-72 space-y-2 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div
              className={cn(
                'inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground',
              )}
            >
              {msg.content}
            </div>
            {msg.proposed_patch && (
              <div className="mt-1">
                {msg.applied ? (
                  <span className="text-xs text-muted-foreground">已套用變更</span>
                ) : (
                  <Button
                    size="sm"
                    disabled={applyPatchMutation.isPending}
                    onClick={() => applyPatchMutation.mutate(msg.id)}
                  >
                    套用變更建議
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}

        {pendingUserMessage && (
          <div className="text-right">
            <div className="inline-block max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
              {pendingUserMessage}
            </div>
          </div>
        )}

        {streaming !== null && (
          <div className="text-left">
            <div className="inline-block max-w-[85%] rounded-lg bg-background px-3 py-2 text-sm whitespace-pre-wrap text-foreground">
              {streaming || '思考中...'}
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Textarea
          className="flex-1"
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
        <Button disabled={sending || !draft.trim()} onClick={handleSend}>
          送出
        </Button>
        {sending && (
          <Button variant="secondary" onClick={handleStop}>
            停止
          </Button>
        )}
      </div>
    </div>
  )
}
