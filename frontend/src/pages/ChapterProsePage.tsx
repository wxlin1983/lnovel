import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { chaptersApi } from '../api/chapters'
import { chapterProseApi } from '../api/chapterProse'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoading } from '@/components/PageLoading'

export function ChapterProsePage() {
  const { novelId, chapterId } = useParams<{ novelId: string; chapterId: string }>()
  const queryClient = useQueryClient()
  const chapterKey = ['chapter', novelId, chapterId]

  const chapterQuery = useQuery({
    queryKey: chapterKey,
    queryFn: () => chaptersApi.get(novelId!, chapterId!),
    enabled: !!novelId && !!chapterId,
  })

  const revisionsQuery = useQuery({
    queryKey: ['chapter-prose-revisions', chapterId],
    queryFn: () => chapterProseApi.listRevisions(novelId!, chapterId!),
    enabled: !!novelId && !!chapterId,
  })

  const [proseDraft, setProseDraft] = useState<string | null>(null)
  const [streaming, setStreaming] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRevisions, setShowRevisions] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setProseDraft(null)
    setStreaming(null)
    setError(null)
  }, [chapterId])

  async function handleGenerate(regenerate: boolean) {
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    setError(null)
    setStreaming('')
    try {
      await chapterProseApi.generate(
        novelId!,
        chapterId!,
        regenerate,
        {
          onDelta: (chunk) => setStreaming((s) => (s ?? '') + chunk),
          onDone: (prose) => {
            queryClient.invalidateQueries({ queryKey: chapterKey })
            queryClient.invalidateQueries({ queryKey: ['chapter-prose-revisions', chapterId] })
            setProseDraft(prose)
            setStreaming(null)
            setGenerating(false)
          },
          onError: (msg) => {
            if (!controller.signal.aborted) setError(msg)
            setStreaming(null)
            setGenerating(false)
          },
        },
        controller.signal,
      )
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err))
      }
      setStreaming(null)
      setGenerating(false)
    } finally {
      abortRef.current = null
    }
  }

  function handleStopGenerate() {
    abortRef.current?.abort()
  }

  const saveMutation = useMutation({
    mutationFn: (prose: string) => chapterProseApi.update(novelId!, chapterId!, prose),
    onSuccess: (updated) => {
      queryClient.setQueryData(chapterKey, updated)
      queryClient.invalidateQueries({ queryKey: ['chapter-prose-revisions', chapterId] })
      toast.success('已儲存手動編輯')
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: () => chapterProseApi.finalize(novelId!, chapterId!),
    onSuccess: (updated) => {
      queryClient.setQueryData(chapterKey, updated)
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
      toast.success('已定稿，故事摘要已更新')
    },
  })

  if (!novelId || !chapterId) return null
  if (chapterQuery.isLoading || !chapterQuery.data) return <PageLoading />

  const chapter = chapterQuery.data
  const prose = streaming ?? proseDraft ?? chapter.prose
  const planApproved = !!chapter.plan_approved_at
  const isFinal = chapter.status === 'final'

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        to={`/novels/${novelId}/chapters/${chapterId}/plan`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 返回章節大綱
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">第 {chapter.chapter_number} 章正文</h1>
        <Badge variant="secondary">{isFinal ? '已定稿' : chapter.status === 'drafted' ? '草稿' : '尚未生成'}</Badge>
      </div>

      {!planApproved && (
        <Alert>
          <AlertDescription>章節大綱尚未核准，需先核准大綱才能生成正文。</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button disabled={!planApproved || generating || isFinal} onClick={() => handleGenerate(false)}>
          {chapter.prose ? '重新生成正文' : '生成正文'}
        </Button>
        {chapter.prose && (
          <Button variant="secondary" disabled={!planApproved || generating || isFinal} onClick={() => handleGenerate(true)}>
            重新生成（保留歷史）
          </Button>
        )}
        {generating && (
          <Button variant="outline" onClick={handleStopGenerate}>
            停止生成
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Textarea
        className="text-sm whitespace-pre-wrap"
        rows={16}
        value={prose}
        disabled={isFinal}
        onChange={(e) => setProseDraft(e.target.value)}
      />

      <div className="flex gap-2">
        <Button variant="secondary" disabled={isFinal || saveMutation.isPending || proseDraft === null} onClick={() => saveMutation.mutate(proseDraft!)}>
          儲存手動編輯
        </Button>
        <Button disabled={isFinal || finalizeMutation.isPending || !prose} onClick={() => finalizeMutation.mutate()}>
          {isFinal ? '已定稿' : '定稿（並更新故事摘要）'}
        </Button>
      </div>

      <div>
        <button className="text-sm text-primary underline" onClick={() => setShowRevisions((v) => !v)}>
          {showRevisions ? '隱藏版本歷史' : `顯示版本歷史（${revisionsQuery.data?.length ?? 0}）`}
        </button>
        {showRevisions && (
          <ul className="mt-2 space-y-2">
            {(revisionsQuery.data ?? []).map((rev) => (
              <li key={rev.id} className="rounded-lg border p-2 text-sm">
                <p className="text-xs text-muted-foreground">{rev.created_at}</p>
                <p className="whitespace-pre-wrap text-foreground">{rev.content.slice(0, 200)}...</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
