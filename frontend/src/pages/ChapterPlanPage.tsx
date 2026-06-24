import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { chaptersApi } from '../api/chapters'
import { chapterPlanApi } from '../api/chapterPlan'
import { entitiesApi } from '../api/entities'
import type { Chapter, PlanBeat } from '../api/types'

export function ChapterPlanPage() {
  const { novelId, chapterId } = useParams<{ novelId: string; chapterId: string }>()
  const queryClient = useQueryClient()
  const chapterKey = ['chapter', novelId, chapterId]

  const chapterQuery = useQuery({
    queryKey: chapterKey,
    queryFn: () => chaptersApi.get(novelId!, chapterId!),
    enabled: !!novelId && !!chapterId,
  })

  const entitiesQuery = useQuery({
    queryKey: ['entities', novelId],
    queryFn: () => entitiesApi.list(novelId!),
    enabled: !!novelId,
  })

  const [beatsDraft, setBeatsDraft] = useState<PlanBeat[] | null>(null)
  const [userDirection, setUserDirection] = useState<string | null>(null)
  const [relevantIds, setRelevantIds] = useState<string[] | null>(null)

  useEffect(() => {
    setBeatsDraft(null)
    setUserDirection(null)
    setRelevantIds(null)
  }, [chapterId])

  function applyUpdate(updated: Chapter) {
    queryClient.setQueryData(chapterKey, updated)
    setBeatsDraft(updated.plan?.beats ?? [])
  }

  const generateMutation = useMutation({
    mutationFn: () =>
      chapterPlanApi.generate(novelId!, chapterId!, {
        user_direction: userDirection ?? chapter?.user_direction,
        relevant_entity_ids: relevantIds ?? chapter?.relevant_entity_ids,
      }),
    onSuccess: applyUpdate,
  })

  const regenerateMutation = useMutation({
    mutationFn: () =>
      chapterPlanApi.regenerate(novelId!, chapterId!, {
        user_direction: userDirection ?? chapter?.user_direction,
        relevant_entity_ids: relevantIds ?? chapter?.relevant_entity_ids,
      }),
    onSuccess: applyUpdate,
  })

  const saveManualMutation = useMutation({
    mutationFn: () => chapterPlanApi.update(novelId!, chapterId!, { beats: beatsDraft ?? [] }),
    onSuccess: applyUpdate,
  })

  const approveMutation = useMutation({
    mutationFn: () => chapterPlanApi.approve(novelId!, chapterId!),
    onSuccess: (updated) => queryClient.setQueryData(chapterKey, updated),
  })

  if (!novelId || !chapterId) return null
  if (chapterQuery.isLoading || !chapterQuery.data) return <p className="p-6">載入中...</p>

  const chapter = chapterQuery.data
  const beats = beatsDraft ?? chapter.plan?.beats ?? []
  const entities = entitiesQuery.data ?? []
  const tagged = relevantIds ?? chapter.relevant_entity_ids
  const busy = generateMutation.isPending || regenerateMutation.isPending

  function toggleEntity(id: string) {
    const current = relevantIds ?? chapter.relevant_entity_ids
    setRelevantIds(current.includes(id) ? current.filter((x) => x !== id) : [...current, id])
  }

  function updateBeat(idx: number, field: keyof PlanBeat, value: string) {
    const next = [...beats]
    next[idx] = { ...next[idx], [field]: value }
    setBeatsDraft(next)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to={`/novels/${novelId}`} className="text-sm text-purple-600 underline">
        ← 返回小說
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">第 {chapter.chapter_number} 章大綱</h1>
        <div className="flex items-center gap-2">
          <span className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
            {chapter.plan_approved_at ? `已核准於 ${chapter.plan_approved_at}` : '尚未核准'}
          </span>
          <Link
            to={`/novels/${novelId}/chapters/${chapterId}/prose`}
            className="rounded bg-gray-100 px-2 py-1 text-sm text-purple-600 underline"
          >
            前往正文 →
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">本章指示（給 AI 的方向）</label>
        <textarea
          className="w-full rounded border px-3 py-2"
          rows={2}
          value={userDirection ?? chapter.user_direction}
          onChange={(e) => setUserDirection(e.target.value)}
        />
      </div>

      {entities.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">標記相關條目（將提供完整細節給 AI）</label>
          <div className="flex flex-wrap gap-2">
            {entities.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`rounded px-2 py-1 text-sm ${
                  tagged.includes(e.id) ? 'bg-purple-600 text-white' : 'bg-gray-100'
                }`}
                onClick={() => toggleEntity(e.id)}
              >
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => generateMutation.mutate()}
        >
          {chapter.plan ? '重新生成大綱' : '生成大綱'}
        </button>
        {chapter.plan && (
          <button
            className="rounded bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() => regenerateMutation.mutate()}
          >
            重新生成（保留歷史）
          </button>
        )}
      </div>

      {(generateMutation.isError || regenerateMutation.isError) && (
        <p className="text-sm text-red-600">
          {String((generateMutation.error ?? regenerateMutation.error) as Error)}
        </p>
      )}

      {beats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">節拍大綱</h2>
          {beats.map((beat, idx) => (
            <div key={idx} className="space-y-2 rounded border p-3">
              <input
                className="w-full rounded border px-2 py-1 text-sm font-medium"
                value={beat.title}
                onChange={(e) => updateBeat(idx, 'title', e.target.value)}
              />
              <textarea
                className="w-full rounded border px-2 py-1 text-sm"
                rows={2}
                value={beat.summary}
                onChange={(e) => updateBeat(idx, 'summary', e.target.value)}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              className="rounded bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
              disabled={saveManualMutation.isPending}
              onClick={() => saveManualMutation.mutate()}
            >
              儲存手動編輯
            </button>
            <button
              className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={approveMutation.isPending || !!chapter.plan_approved_at}
              onClick={() => approveMutation.mutate()}
            >
              {chapter.plan_approved_at ? '已核准' : '核准大綱'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
