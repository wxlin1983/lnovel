import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { chaptersApi } from '../api/chapters'
import { chapterProseApi } from '../api/chapterProse'

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
    },
  })

  const finalizeMutation = useMutation({
    mutationFn: () => chapterProseApi.finalize(novelId!, chapterId!),
    onSuccess: (updated) => {
      queryClient.setQueryData(chapterKey, updated)
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
    },
  })

  if (!novelId || !chapterId) return null
  if (chapterQuery.isLoading || !chapterQuery.data) return <p className="p-6">載入中...</p>

  const chapter = chapterQuery.data
  const prose = streaming ?? proseDraft ?? chapter.prose
  const planApproved = !!chapter.plan_approved_at
  const isFinal = chapter.status === 'final'

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to={`/novels/${novelId}/chapters/${chapterId}/plan`} className="text-sm text-purple-600 underline">
        ← 返回章節大綱
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">第 {chapter.chapter_number} 章正文</h1>
        <span className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
          {isFinal ? '已定稿' : chapter.status === 'drafted' ? '草稿' : '尚未生成'}
        </span>
      </div>

      {!planApproved && (
        <p className="rounded bg-yellow-50 p-3 text-sm text-yellow-800">
          章節大綱尚未核准，需先核准大綱才能生成正文。
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={!planApproved || generating || isFinal}
          onClick={() => handleGenerate(false)}
        >
          {chapter.prose ? '重新生成正文' : '生成正文'}
        </button>
        {chapter.prose && (
          <button
            className="rounded bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
            disabled={!planApproved || generating || isFinal}
            onClick={() => handleGenerate(true)}
          >
            重新生成（保留歷史）
          </button>
        )}
        {generating && (
          <button className="rounded bg-gray-300 px-3 py-2 text-sm" onClick={handleStopGenerate}>
            停止生成
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <textarea
        className="w-full rounded border px-3 py-2 text-sm whitespace-pre-wrap"
        rows={16}
        value={prose}
        disabled={isFinal}
        onChange={(e) => setProseDraft(e.target.value)}
      />

      <div className="flex gap-2">
        <button
          className="rounded bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
          disabled={isFinal || saveMutation.isPending || proseDraft === null}
          onClick={() => saveMutation.mutate(proseDraft!)}
        >
          儲存手動編輯
        </button>
        <button
          className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={isFinal || finalizeMutation.isPending || !prose}
          onClick={() => finalizeMutation.mutate()}
        >
          {isFinal ? '已定稿' : '定稿（並更新故事摘要）'}
        </button>
      </div>

      <div>
        <button className="text-sm text-purple-600 underline" onClick={() => setShowRevisions((v) => !v)}>
          {showRevisions ? '隱藏版本歷史' : `顯示版本歷史（${revisionsQuery.data?.length ?? 0}）`}
        </button>
        {showRevisions && (
          <ul className="mt-2 space-y-2">
            {(revisionsQuery.data ?? []).map((rev) => (
              <li key={rev.id} className="rounded border p-2 text-sm">
                <p className="text-xs text-gray-400">{rev.created_at}</p>
                <p className="whitespace-pre-wrap text-gray-700">{rev.content.slice(0, 200)}...</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
