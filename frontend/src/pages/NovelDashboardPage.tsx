import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { novelsApi } from '../api/novels'
import { novelPremiseApi } from '../api/novelPremise'
import { novelOutlineApi } from '../api/novelOutline'
import { entitiesApi } from '../api/entities'
import { chaptersApi } from '../api/chapters'
import type { Entity, EntityType, OutlineChapter } from '../api/types'
import { EntityForm } from '../components/EntityForm'
import { EntityChatPanel } from '../components/EntityChatPanel'

const TYPE_LABELS: Record<EntityType, string> = {
  character: '角色',
  location: '地點',
  storyline: '故事線',
}

const CHAPTER_STATUS_LABELS = {
  planned: '規劃中',
  drafted: '草稿',
  final: '完稿',
} as const

export function NovelDashboardPage() {
  const { novelId } = useParams<{ novelId: string }>()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [chattingId, setChattingId] = useState<string | null>(null)
  const [premiseDraft, setPremiseDraft] = useState<string | null>(null)
  const [inspirationDraft, setInspirationDraft] = useState<string | null>(null)
  const [premiseProposal, setPremiseProposal] = useState<string | null>(null)
  const [outlineChapterCount, setOutlineChapterCount] = useState(10)
  const [outlineDraft, setOutlineDraft] = useState<OutlineChapter[] | null>(null)

  const novelQuery = useQuery({
    queryKey: ['novel', novelId],
    queryFn: () => novelsApi.get(novelId!),
    enabled: !!novelId,
  })

  const entitiesQuery = useQuery({
    queryKey: ['entities', novelId],
    queryFn: () => entitiesApi.list(novelId!),
    enabled: !!novelId,
  })

  const chaptersQuery = useQuery({
    queryKey: ['chapters', novelId],
    queryFn: () => chaptersApi.list(novelId!),
    enabled: !!novelId,
  })

  const createChapterMutation = useMutation({
    mutationFn: () => {
      const nextNumber = (chaptersQuery.data?.reduce((max, c) => Math.max(max, c.chapter_number), 0) ?? 0) + 1
      const outlineMatch = novelQuery.data?.book_outline.find((c) => c.chapter_number === nextNumber)
      return chaptersApi.create(novelId!, { chapter_number: nextNumber, title: outlineMatch?.title })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chapters', novelId] }),
  })

  const updateNovelMutation = useMutation({
    mutationFn: (premise: string) => novelsApi.update(novelId!, { premise }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
      setPremiseDraft(null)
    },
  })

  const generatePremiseMutation = useMutation({
    mutationFn: () => novelPremiseApi.generate(novelId!, { inspiration: inspirationDraft ?? undefined }),
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
      setInspirationDraft(null)
      setPremiseProposal(proposal.premise)
    },
  })

  const generateOutlineMutation = useMutation({
    mutationFn: () => novelOutlineApi.generate(novelId!, { chapter_count: outlineChapterCount }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['novel', novelId], updated)
      setOutlineDraft(null)
    },
  })

  const saveOutlineMutation = useMutation({
    mutationFn: (chapters: OutlineChapter[]) => novelOutlineApi.update(novelId!, chapters),
    onSuccess: (updated) => {
      queryClient.setQueryData(['novel', novelId], updated)
      setOutlineDraft(null)
    },
  })

  const createEntityMutation = useMutation({
    mutationFn: entitiesApi.create.bind(null, novelId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', novelId] })
      setShowCreate(false)
    },
  })

  const updateEntityMutation = useMutation({
    mutationFn: ({ entityId, ...payload }: { entityId: string; name: string; description: string; fields: Record<string, string> }) =>
      entitiesApi.update(novelId!, entityId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', novelId] })
      setEditingId(null)
    },
  })

  const deleteEntityMutation = useMutation({
    mutationFn: (entityId: string) => entitiesApi.remove(novelId!, entityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entities', novelId] }),
  })

  if (!novelId) return null
  if (novelQuery.isLoading || !novelQuery.data) return <p className="p-6">載入中...</p>

  const novel = novelQuery.data
  const entities = entitiesQuery.data ?? []
  const grouped = (Object.keys(TYPE_LABELS) as EntityType[]).map((type) => ({
    type,
    items: entities.filter((e) => e.type === type),
  }))
  const outline = outlineDraft ?? novel.book_outline

  function updateOutlineChapter(idx: number, field: 'title' | 'summary', value: string) {
    const next = [...outline]
    next[idx] = { ...next[idx], [field]: value }
    setOutlineDraft(next)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to="/" className="text-sm text-purple-600 underline">
        ← 返回小說列表
      </Link>
      <h1 className="text-2xl font-semibold">{novel.title}</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">靈感</label>
        <p className="text-sm text-gray-500">輸入你的靈感片段，讓 AI 提案一段故事大綱（不會自動覆蓋下方大綱）。</p>
        <textarea
          className="w-full rounded border px-3 py-2"
          rows={2}
          placeholder="例如：一個會說話的貓在末日後的城市裡尋找最後一位人類"
          value={inspirationDraft ?? novel.inspiration}
          onChange={(e) => setInspirationDraft(e.target.value)}
        />
        <button
          className="rounded bg-purple-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={generatePremiseMutation.isPending}
          onClick={() => generatePremiseMutation.mutate()}
        >
          {generatePremiseMutation.isPending ? 'AI 生成中...' : '用 AI 生成故事大綱'}
        </button>
        {generatePremiseMutation.isError && (
          <p className="text-sm text-red-600">{(generatePremiseMutation.error as Error).message}</p>
        )}
      </div>

      {premiseProposal && (
        <div className="space-y-2 rounded border border-purple-300 bg-purple-50 p-3">
          <p className="text-sm font-medium text-purple-700">AI 建議的故事大綱：</p>
          <p className="text-sm whitespace-pre-wrap">{premiseProposal}</p>
          <div className="flex gap-2">
            <button
              className="rounded bg-purple-600 px-3 py-1 text-sm text-white"
              onClick={() => {
                setPremiseDraft(premiseProposal)
                setPremiseProposal(null)
              }}
            >
              套用到故事大綱
            </button>
            <button className="text-sm text-gray-500 underline" onClick={() => setPremiseProposal(null)}>
              捨棄
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium">故事大綱</label>
        <textarea
          className="w-full rounded border px-3 py-2"
          rows={3}
          value={premiseDraft ?? novel.premise}
          onChange={(e) => setPremiseDraft(e.target.value)}
        />
        <button
          className="rounded bg-purple-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={premiseDraft === null || updateNovelMutation.isPending}
          onClick={() => updateNovelMutation.mutate(premiseDraft!)}
        >
          儲存大綱
        </button>
      </div>

      <div className="space-y-3 border-t pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">全書章節規劃</h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              className="w-16 rounded border px-2 py-1 text-sm"
              value={outlineChapterCount}
              onChange={(e) => setOutlineChapterCount(Number(e.target.value))}
            />
            <button
              className="rounded bg-purple-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              disabled={generateOutlineMutation.isPending}
              onClick={() => {
                if (novel.book_outline.length === 0 || window.confirm('重新生成將覆蓋目前的章節規劃，確定要繼續嗎？')) {
                  generateOutlineMutation.mutate()
                }
              }}
            >
              {generateOutlineMutation.isPending
                ? '生成中...'
                : novel.book_outline.length > 0
                  ? '重新生成'
                  : '用 AI 生成規劃'}
            </button>
          </div>
        </div>

        {generateOutlineMutation.isError && (
          <p className="text-sm text-red-600">{(generateOutlineMutation.error as Error).message}</p>
        )}

        {outline.length === 0 && <p className="text-sm text-gray-400">尚無章節規劃</p>}

        {outline.length > 0 && (
          <div className="space-y-2">
            {outline.map((c, idx) => (
              <div key={idx} className="space-y-1 rounded border p-3">
                <p className="text-sm font-medium text-gray-500">第 {c.chapter_number} 章</p>
                <input
                  className="w-full rounded border px-2 py-1 text-sm font-medium"
                  value={c.title}
                  onChange={(e) => updateOutlineChapter(idx, 'title', e.target.value)}
                />
                <textarea
                  className="w-full rounded border px-2 py-1 text-sm"
                  rows={2}
                  value={c.summary}
                  onChange={(e) => updateOutlineChapter(idx, 'summary', e.target.value)}
                />
              </div>
            ))}
            <button
              className="rounded bg-gray-200 px-3 py-2 text-sm disabled:opacity-50"
              disabled={saveOutlineMutation.isPending || outlineDraft === null}
              onClick={() => saveOutlineMutation.mutate(outline)}
            >
              儲存規劃編輯
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">世界觀設定</h2>
        <button
          className="rounded bg-purple-600 px-3 py-1 text-sm text-white"
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? '取消新增' : '+ 新增條目'}
        </button>
      </div>

      {showCreate && (
        <EntityForm
          submitLabel="建立"
          onCancel={() => setShowCreate(false)}
          onSubmit={(values) => createEntityMutation.mutate(values)}
        />
      )}

      {grouped.map(({ type, items }) => (
        <div key={type} className="space-y-2">
          <h3 className="font-medium text-gray-700">{TYPE_LABELS[type]}</h3>
          {items.length === 0 && <p className="text-sm text-gray-400">尚無{TYPE_LABELS[type]}</p>}
          <ul className="space-y-2">
            {items.map((entity: Entity) => (
              <li key={entity.id} className="rounded border p-3">
                {editingId === entity.id ? (
                  <EntityForm
                    initial={entity}
                    submitLabel="儲存"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) =>
                      updateEntityMutation.mutate({ entityId: entity.id, ...values })
                    }
                  />
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{entity.name}</p>
                      <p className="text-sm text-gray-500">{entity.description}</p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button
                        className="text-purple-600"
                        onClick={() => setChattingId(chattingId === entity.id ? null : entity.id)}
                      >
                        {chattingId === entity.id ? '關閉討論' : '與 AI 討論'}
                      </button>
                      <button className="text-purple-600" onClick={() => setEditingId(entity.id)}>
                        編輯
                      </button>
                      <button
                        className="text-red-600"
                        onClick={() => deleteEntityMutation.mutate(entity.id)}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                )}
                {chattingId === entity.id && (
                  <div className="mt-3">
                    <EntityChatPanel novelId={novelId} entityId={entity.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="flex items-center justify-between border-t pt-6">
        <h2 className="text-lg font-semibold">章節</h2>
        <button
          className="rounded bg-purple-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          disabled={createChapterMutation.isPending}
          onClick={() => createChapterMutation.mutate()}
        >
          + 新增章節
        </button>
      </div>

      <ul className="space-y-2">
        {(chaptersQuery.data ?? []).map((chapter) => (
          <li key={chapter.id} className="flex items-center justify-between rounded border p-3">
            <Link
              to={`/novels/${novelId}/chapters/${chapter.id}/plan`}
              className="font-medium hover:underline"
            >
              第 {chapter.chapter_number} 章 {chapter.title || '（未命名）'}
            </Link>
            <span className="text-sm text-gray-500">{CHAPTER_STATUS_LABELS[chapter.status]}</span>
          </li>
        ))}
        {(chaptersQuery.data ?? []).length === 0 && <p className="text-sm text-gray-400">尚無章節</p>}
      </ul>
    </div>
  )
}
