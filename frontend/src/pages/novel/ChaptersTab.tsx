import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Files } from 'lucide-react'
import { novelsApi } from '../../api/novels'
import { chaptersApi } from '../../api/chapters'
import type { ChapterStatus } from '../../api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'

const CHAPTER_STATUS_LABELS: Record<ChapterStatus, string> = {
  planned: '規劃中',
  drafted: '草稿',
  final: '完稿',
}

export function ChaptersTab() {
  const { novelId } = useParams<{ novelId: string }>()
  const queryClient = useQueryClient()

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

  const createChapterMutation = useMutation({
    mutationFn: () => {
      const nextNumber = (chaptersQuery.data?.reduce((max, c) => Math.max(max, c.chapter_number), 0) ?? 0) + 1
      const outlineMatch = novelQuery.data?.book_outline.find((c) => c.chapter_number === nextNumber)
      return chaptersApi.create(novelId!, {
        chapter_number: nextNumber,
        title: outlineMatch?.title,
        user_direction: outlineMatch?.summary,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chapters', novelId] }),
  })

  if (!novelId) return null
  const chapters = chaptersQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">章節</h2>
        <Button disabled={createChapterMutation.isPending} onClick={() => createChapterMutation.mutate()}>
          + 新增章節
        </Button>
      </div>

      {chapters.length === 0 ? (
        <EmptyState icon={Files} title="尚無章節" description="可以直接新增章節，或先到「章節規劃」分頁套用一個規劃條目。" />
      ) : (
        <div className="space-y-2">
          {chapters.map((chapter) => (
            <Card key={chapter.id}>
              <CardContent className="flex items-center justify-between">
                <Link to={`/novels/${novelId}/chapters/${chapter.id}/plan`} className="font-medium hover:underline">
                  第 {chapter.chapter_number} 章 {chapter.title || '（未命名）'}
                </Link>
                <Badge
                  variant={chapter.status === 'planned' ? 'outline' : 'secondary'}
                  className={cn(chapter.status === 'final' && 'bg-green-600/10 text-green-700')}
                >
                  {CHAPTER_STATUS_LABELS[chapter.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
