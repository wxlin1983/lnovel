import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BookOpen } from 'lucide-react'
import { novelsApi } from '../../api/novels'
import { novelOutlineApi } from '../../api/novelOutline'
import { chaptersApi } from '../../api/chapters'
import type { OutlineChapter } from '../../api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EmptyState } from '@/components/EmptyState'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function OutlineTab() {
  const { novelId } = useParams<{ novelId: string }>()
  const queryClient = useQueryClient()
  const [outlineChapterCount, setOutlineChapterCount] = useState(10)
  const [outlineDraft, setOutlineDraft] = useState<OutlineChapter[] | null>(null)
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)

  const novelQuery = useQuery({
    queryKey: ['novel', novelId],
    queryFn: () => novelsApi.get(novelId!),
    enabled: !!novelId,
  })

  const chaptersQuery = useQuery({
    queryKey: ['chapters', novelId],
    queryFn: () => chaptersApi.list(novelId!),
    enabled: !!novelId,
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
      toast.success('已儲存規劃編輯')
    },
  })

  const applyOutlineMutation = useMutation({
    mutationFn: (c: OutlineChapter) =>
      chaptersApi.create(novelId!, {
        chapter_number: c.chapter_number,
        title: c.title,
        user_direction: c.summary,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', novelId] })
      toast.success('已建立章節')
    },
  })

  if (!novelId || !novelQuery.data) return null
  const novel = novelQuery.data
  const outline = outlineDraft ?? novel.book_outline
  const chapterByNumber = new Map((chaptersQuery.data ?? []).map((c) => [c.chapter_number, c]))

  function updateOutlineChapter(idx: number, field: 'title' | 'summary', value: string) {
    const next = [...outline]
    next[idx] = { ...next[idx], [field]: value }
    setOutlineDraft(next)
  }

  function handleGenerateClick() {
    if (novel.book_outline.length === 0) {
      generateOutlineMutation.mutate()
    } else {
      setConfirmRegenerate(true)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">全書章節規劃</h2>
        <div className="flex items-center gap-2">
          <Label htmlFor="chapter-count" className="text-sm text-muted-foreground">
            章數
          </Label>
          <Input
            id="chapter-count"
            type="number"
            min={1}
            max={50}
            className="w-16"
            value={outlineChapterCount}
            onChange={(e) => setOutlineChapterCount(Number(e.target.value))}
          />
          <Button disabled={generateOutlineMutation.isPending} onClick={handleGenerateClick}>
            {generateOutlineMutation.isPending ? '生成中...' : novel.book_outline.length > 0 ? '重新生成' : '用 AI 生成規劃'}
          </Button>
        </div>
      </div>

      {generateOutlineMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(generateOutlineMutation.error as Error).message}</AlertDescription>
        </Alert>
      )}

      {outline.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="尚無章節規劃"
          description={novel.premise ? '點擊上方按鈕，讓 AI 依故事大綱規劃全書章節。' : '請先到「總覽」設定故事大綱，再來規劃章節。'}
        />
      ) : (
        <div className="space-y-3">
          {outline.map((c, idx) => {
            const existingChapter = chapterByNumber.get(c.chapter_number)
            const applyingThis =
              applyOutlineMutation.isPending && applyOutlineMutation.variables?.chapter_number === c.chapter_number
            return (
              <Card key={idx}>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-muted-foreground">第 {c.chapter_number} 章</p>
                    {existingChapter ? (
                      <Link
                        to={`/novels/${novelId}/chapters/${existingChapter.id}/plan`}
                        className="text-sm text-primary underline"
                      >
                        已建立章節 →
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={applyOutlineMutation.isPending}
                        onClick={() => applyOutlineMutation.mutate(c)}
                      >
                        {applyingThis ? '建立中...' : '套用為章節'}
                      </Button>
                    )}
                  </div>
                  <Input
                    className="font-medium"
                    value={c.title}
                    onChange={(e) => updateOutlineChapter(idx, 'title', e.target.value)}
                  />
                  <Textarea
                    rows={2}
                    value={c.summary}
                    onChange={(e) => updateOutlineChapter(idx, 'summary', e.target.value)}
                  />
                </CardContent>
              </Card>
            )
          })}
          <Button
            variant="secondary"
            disabled={saveOutlineMutation.isPending || outlineDraft === null}
            onClick={() => saveOutlineMutation.mutate(outline)}
          >
            儲存規劃編輯
          </Button>
          {applyOutlineMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{(applyOutlineMutation.error as Error).message}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <AlertDialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重新生成章節規劃？</AlertDialogTitle>
            <AlertDialogDescription>這會覆蓋目前的章節規劃內容，已套用為章節的部分不受影響。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => generateOutlineMutation.mutate()}>確定重新生成</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
