import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { chaptersApi } from '../api/chapters'
import { chapterPlanApi } from '../api/chapterPlan'
import { entitiesApi } from '../api/entities'
import type { Chapter, PlanBeat } from '../api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageLoading } from '@/components/PageLoading'

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
  const [targetWordCount, setTargetWordCount] = useState<string | null>(null)

  useEffect(() => {
    setBeatsDraft(null)
    setUserDirection(null)
    setRelevantIds(null)
    setTargetWordCount(null)
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
    onSuccess: (updated) => {
      applyUpdate(updated)
      toast.success('已儲存手動編輯')
    },
  })

  const saveWordCountMutation = useMutation({
    mutationFn: (count: number | null) =>
      chaptersApi.update(novelId!, chapterId!, { target_word_count: count }),
    onSuccess: (updated) => {
      queryClient.setQueryData(chapterKey, updated)
      toast.success('已儲存目標字數')
    },
  })

  const approveMutation = useMutation({
    mutationFn: () => chapterPlanApi.approve(novelId!, chapterId!),
    onSuccess: (updated) => {
      queryClient.setQueryData(chapterKey, updated)
      toast.success('已核准大綱')
    },
  })

  if (!novelId || !chapterId) return null
  if (chapterQuery.isLoading || !chapterQuery.data) return <PageLoading />

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
      <Link to={`/novels/${novelId}/chapters`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 返回章節列表
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">第 {chapter.chapter_number} 章大綱</h1>
        <div className="flex items-center gap-2">
          <Badge variant={chapter.plan_approved_at ? 'secondary' : 'outline'}>
            {chapter.plan_approved_at ? `已核准於 ${chapter.plan_approved_at}` : '尚未核准'}
          </Badge>
          <Link to={`/novels/${novelId}/chapters/${chapterId}/prose`} className="text-sm text-primary underline">
            前往正文 →
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-direction">本章指示（給 AI 的方向）</Label>
            <Textarea
              id="user-direction"
              rows={2}
              value={userDirection ?? chapter.user_direction}
              onChange={(e) => setUserDirection(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="target-word-count">目標字數</Label>
              <Input
                id="target-word-count"
                type="number"
                min={100}
                step={100}
                placeholder="例：3000"
                className="w-36"
                value={targetWordCount ?? (chapter.target_word_count?.toString() ?? '')}
                onChange={(e) => setTargetWordCount(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={saveWordCountMutation.isPending || targetWordCount === null}
              onClick={() => {
                const v = targetWordCount?.trim()
                saveWordCountMutation.mutate(v ? parseInt(v, 10) : null)
                setTargetWordCount(null)
              }}
            >
              儲存
            </Button>
            {chapter.target_word_count && (
              <span className="text-sm text-muted-foreground">
                目前設定：{chapter.target_word_count.toLocaleString()} 字
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {entities.length > 0 && (
        <div className="space-y-2">
          <Label>標記相關條目（將提供完整細節給 AI）</Label>
          <div className="flex flex-wrap gap-2">
            {entities.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleEntity(e.id)}
              >
                <Badge variant={tagged.includes(e.id) ? 'default' : 'outline'}>{e.name}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => generateMutation.mutate()}>
          {chapter.plan ? '重新生成大綱' : '生成大綱'}
        </Button>
        {chapter.plan && (
          <Button variant="secondary" disabled={busy} onClick={() => regenerateMutation.mutate()}>
            重新生成（保留歷史）
          </Button>
        )}
      </div>

      {(generateMutation.isError || regenerateMutation.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {String((generateMutation.error ?? regenerateMutation.error) as Error)}
          </AlertDescription>
        </Alert>
      )}

      {beats.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">節拍大綱</h2>
          {beats.map((beat, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    ch{chapter.chapter_number}-{idx + 1}
                  </span>
                  <Input value={beat.title} onChange={(e) => updateBeat(idx, 'title', e.target.value)} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea rows={2} value={beat.summary} onChange={(e) => updateBeat(idx, 'summary', e.target.value)} />
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-2">
            <Button variant="secondary" disabled={saveManualMutation.isPending} onClick={() => saveManualMutation.mutate()}>
              儲存手動編輯
            </Button>
            <Button
              disabled={approveMutation.isPending || !!chapter.plan_approved_at}
              onClick={() => approveMutation.mutate()}
            >
              {chapter.plan_approved_at ? '已核准' : '核准大綱'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
