import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Files, GripVertical, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { novelsApi } from '../../api/novels'
import { chaptersApi } from '../../api/chapters'
import type { Chapter, ChapterStatus } from '../../api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const CHAPTER_STATUS_LABELS: Record<ChapterStatus, string> = {
  planned: '規劃中',
  drafted: '草稿',
  final: '完稿',
}

interface SortableChapterRowProps {
  chapter: Chapter
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  novelId: string
}

function SortableChapterRow({
  chapter,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  novelId,
}: SortableChapterRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'opacity-50 shadow-lg')}
    >
      <CardContent className="flex items-center gap-2 py-3">
        <button
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label="拖曳排序"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Link
          to={`/novels/${novelId}/chapters/${chapter.id}/plan`}
          className="flex-1 font-medium hover:underline"
        >
          第 {chapter.chapter_number} 章 {chapter.title || '（未命名）'}
        </Link>

        <Badge
          variant={chapter.status === 'planned' ? 'outline' : 'secondary'}
          className={cn(chapter.status === 'final' && 'bg-green-600/10 text-green-700')}
        >
          {CHAPTER_STATUS_LABELS[chapter.status]}
        </Badge>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isFirst}
            onClick={onMoveUp}
            aria-label="上移"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isLast}
            onClick={onMoveDown}
            aria-label="下移"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                aria-label="刪除章節"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>確定刪除章節？</AlertDialogTitle>
                <AlertDialogDescription>
                  第 {chapter.chapter_number} 章「{chapter.title || '未命名'}」及其所有內容將永久刪除，此操作無法還原。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  刪除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
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

  const reorderMutation = useMutation({
    mutationFn: (chapterIds: string[]) => chaptersApi.reorder(novelId!, chapterIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chapters', novelId] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (chapterId: string) => chaptersApi.remove(novelId!, chapterId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chapters', novelId] }),
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  if (!novelId) return null
  const chapters = chaptersQuery.data ?? []

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = chapters.findIndex((c) => c.id === active.id)
    const newIndex = chapters.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(chapters, oldIndex, newIndex)
    reorderMutation.mutate(reordered.map((c) => c.id))
  }

  function handleMove(index: number, direction: -1 | 1) {
    const reordered = arrayMove(chapters, index, index + direction)
    reorderMutation.mutate(reordered.map((c) => c.id))
  }

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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {chapters.map((chapter, index) => (
                <SortableChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  isFirst={index === 0}
                  isLast={index === chapters.length - 1}
                  onMoveUp={() => handleMove(index, -1)}
                  onMoveDown={() => handleMove(index, 1)}
                  onDelete={() => deleteMutation.mutate(chapter.id)}
                  novelId={novelId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
