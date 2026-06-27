import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { novelPremiseApi } from '../../api/novelPremise'
import { novelOutlineApi } from '../../api/novelOutline'
import { chaptersApi } from '../../api/chapters'
import { chapterPlanApi } from '../../api/chapterPlan'
import { novelsApi } from '../../api/novels'
import type { ChatTurn, Chapter, OutlineChapter } from '../../api/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

// ─── Chat panel (right column) ───────────────────────────────────────────────

interface ChatPanelProps {
  turns: ChatTurn[]
  onApply?: (content: string) => void
  applyLabel?: string
  onRevise: (message: string) => void
  revisePending: boolean
  placeholder?: string
  disabled?: boolean
}

function ChatPanel({
  turns,
  onApply,
  applyLabel = '套用',
  onRevise,
  revisePending,
  placeholder = '例如：請讓故事更黑暗一點…',
  disabled = false,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  function submit() {
    const msg = input.trim()
    if (!msg) return
    onRevise(msg)
    setInput('')
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">對話紀錄</p>

      {/* Thread */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {turns.length === 0 && (
          <p className="text-xs text-muted-foreground">尚無對話，請先在左側生成內容。</p>
        )}
        {turns.map((turn, i) => (
          <div
            key={i}
            className={cn(
              'rounded-lg px-3 py-2 text-sm',
              turn.role === 'user'
                ? 'ml-4 bg-primary text-primary-foreground'
                : 'mr-4 bg-background shadow-sm',
            )}
          >
            <p className="whitespace-pre-wrap">{turn.content}</p>
            {turn.role === 'assistant' && onApply && (
              <button
                className="mt-1.5 text-xs font-medium text-primary underline hover:no-underline"
                onClick={() => onApply(turn.content)}
              >
                {applyLabel}
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="space-y-2 border-t pt-2">
        <Textarea
          rows={2}
          className="text-sm"
          placeholder={placeholder}
          value={input}
          disabled={disabled || turns.length === 0}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
        />
        <Button
          size="sm"
          className="w-full"
          disabled={disabled || revisePending || !input.trim() || turns.length === 0}
          onClick={submit}
        >
          {revisePending ? '修改中…' : '根據意見修改 ⌘↵'}
        </Button>
      </div>
    </div>
  )
}

// ─── Stage 1: Premise ────────────────────────────────────────────────────────

function PremiseStage({ novelId }: { novelId: string }) {
  const queryClient = useQueryClient()
  const [inspiration, setInspiration] = useState('')

  const novelQuery = useQuery({
    queryKey: ['novel', novelId],
    queryFn: () => novelsApi.get(novelId),
  })
  const novel = novelQuery.data

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
  }

  const generateMutation = useMutation({
    mutationFn: () => novelPremiseApi.generate(novelId, { inspiration: inspiration || undefined }),
    onSuccess: invalidate,
    onError: (e) => toast.error(String(e)),
  })

  const reviseMutation = useMutation({
    mutationFn: (message: string) => novelPremiseApi.revise(novelId, message),
    onSuccess: invalidate,
    onError: (e) => toast.error(String(e)),
  })

  const applyMutation = useMutation({
    mutationFn: (premise: string) => novelsApi.update(novelId, { premise }),
    onSuccess: () => { invalidate(); toast.success('已套用大綱') },
    onError: (e) => toast.error(String(e)),
  })

  const busy = generateMutation.isPending || reviseMutation.isPending

  return (
    <div className="space-y-3">
      <SectionHeader index={1} title="故事大綱" done={!!novel?.premise} />
      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Left */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="inspiration">靈感</Label>
            <Textarea
              id="inspiration"
              rows={3}
              placeholder="例如：一個會說話的貓在末日後的城市裡尋找最後一位人類"
              value={inspiration}
              onChange={(e) => setInspiration(e.target.value)}
            />
          </div>
          <Button disabled={busy} onClick={() => generateMutation.mutate()}>
            {generateMutation.isPending ? 'AI 生成中…' : '生成故事大綱'}
          </Button>

          {novel?.premise && (
            <div className="rounded-lg border bg-background p-3 text-sm whitespace-pre-wrap">
              <p className="mb-1 text-xs font-medium text-muted-foreground">目前套用的大綱</p>
              {novel.premise}
            </div>
          )}

          {generateMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{String(generateMutation.error)}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right */}
        <ChatPanel
          turns={novel?.premise_chat ?? []}
          onApply={(content) => applyMutation.mutate(content)}
          applyLabel="套用此大綱"
          onRevise={(msg) => reviseMutation.mutate(msg)}
          revisePending={reviseMutation.isPending}
          placeholder="例如：請讓故事基調更黑暗，加入復仇主題"
        />
      </div>
    </div>
  )
}

// ─── Stage 2: Outline ────────────────────────────────────────────────────────

function OutlineStage({ novelId }: { novelId: string }) {
  const queryClient = useQueryClient()
  const [chapterCount, setChapterCount] = useState(10)
  const [direction, setDirection] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<OutlineChapter | null>(null)

  const novelQuery = useQuery({
    queryKey: ['novel', novelId],
    queryFn: () => novelsApi.get(novelId),
  })
  const novel = novelQuery.data

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
    queryClient.invalidateQueries({ queryKey: ['chapters', novelId] })
  }

  const generateMutation = useMutation({
    mutationFn: () =>
      novelOutlineApi.generate(novelId, { chapter_count: chapterCount, user_direction: direction || undefined }),
    onSuccess: invalidate,
    onError: (e) => toast.error(String(e)),
  })

  const reviseMutation = useMutation({
    mutationFn: (message: string) => novelOutlineApi.revise(novelId, message),
    onSuccess: invalidate,
    onError: (e) => toast.error(String(e)),
  })

  const saveMutation = useMutation({
    mutationFn: (chapters: OutlineChapter[]) => novelOutlineApi.update(novelId, chapters),
    onSuccess: () => { invalidate(); setEditingIdx(null) },
  })

  const applyMutation = useMutation({
    mutationFn: () => novelOutlineApi.apply(novelId),
    onSuccess: () => { invalidate(); toast.success('已套用至章節，舊章節已覆蓋') },
    onError: (e) => toast.error(String(e)),
  })

  const outline = novel?.book_outline ?? []
  const hasOutline = outline.length > 0
  const disabled = !novel?.premise
  const busy = generateMutation.isPending || reviseMutation.isPending

  function saveEdit() {
    if (editingIdx === null || !editDraft) return
    saveMutation.mutate(outline.map((c, i) => (i === editingIdx ? editDraft : c)))
  }

  return (
    <div className={cn('space-y-3', disabled && 'pointer-events-none opacity-40')}>
      <SectionHeader index={2} title="全書架構" done={hasOutline} />
      {disabled && <p className="text-sm text-muted-foreground">請先完成第一階段故事大綱。</p>}

      <div className="grid grid-cols-[1fr_320px] gap-4">
        {/* Left */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="chapter-count">章節數</Label>
              <Input
                id="chapter-count"
                type="number"
                min={1}
                max={100}
                className="w-24"
                value={chapterCount}
                onChange={(e) => setChapterCount(Number(e.target.value))}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="outline-direction">整體指示（選填）</Label>
              <Input
                id="outline-direction"
                placeholder="例如：三幕式結構，高潮在第 8 章"
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              />
            </div>
            <Button disabled={busy} onClick={() => generateMutation.mutate()}>
              {generateMutation.isPending ? 'AI 生成中…' : hasOutline ? '重新生成' : '生成全書架構'}
            </Button>
          </div>

          {hasOutline && (
            <>
              <div className="space-y-2">
                {outline.map((chapter, idx) => (
                  <Card key={idx}>
                    <CardContent className="py-3">
                      {editingIdx === idx ? (
                        <div className="space-y-2">
                          <Input
                            value={editDraft?.title ?? ''}
                            onChange={(e) => setEditDraft((d) => d && { ...d, title: e.target.value })}
                            placeholder="章節標題"
                          />
                          <Textarea
                            rows={2}
                            value={editDraft?.summary ?? ''}
                            onChange={(e) => setEditDraft((d) => d && { ...d, summary: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit} disabled={saveMutation.isPending}>儲存</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingIdx(null)}>取消</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium">第 {chapter.chapter_number} 章 {chapter.title}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">{chapter.summary}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => { setEditingIdx(idx); setEditDraft(chapter) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
                {applyMutation.isPending ? '套用中…' : '確認並套用至章節 →'}
              </Button>
            </>
          )}

          {(generateMutation.isError || applyMutation.isError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {String((generateMutation.error ?? applyMutation.error) as Error)}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right */}
        <ChatPanel
          turns={novel?.outline_chat ?? []}
          onRevise={(msg) => reviseMutation.mutate(msg)}
          revisePending={reviseMutation.isPending}
          placeholder="例如：把第三章改成高潮，並在中段加入反轉"
          disabled={disabled}
        />
      </div>
    </div>
  )
}

// ─── Stage 3: Chapter Plans ──────────────────────────────────────────────────

function ChapterPlanRow({ novelId, chapter }: { novelId: string; chapter: Chapter }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState(chapter.user_direction)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['chapters', novelId] })
  }

  const generateMutation = useMutation({
    mutationFn: () => chapterPlanApi.generate(novelId, chapter.id, { user_direction: direction || undefined }),
    onSuccess: (updated) => { invalidate(); queryClient.setQueryData(['chapter', novelId, chapter.id], updated) },
    onError: (e) => toast.error(String(e)),
  })

  const reviseMutation = useMutation({
    mutationFn: () => chapterPlanApi.regenerate(novelId, chapter.id, { user_direction: direction || undefined }),
    onSuccess: (updated) => { invalidate(); queryClient.setQueryData(['chapter', novelId, chapter.id], updated) },
    onError: (e) => toast.error(String(e)),
  })

  const approveMutation = useMutation({
    mutationFn: () => chapterPlanApi.approve(novelId, chapter.id),
    onSuccess: invalidate,
    onError: (e) => toast.error(String(e)),
  })

  const beats = chapter.plan?.beats ?? []
  const busy = generateMutation.isPending || reviseMutation.isPending

  return (
    <Card>
      <CardHeader className="py-3">
        <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="flex-1 font-medium">
            第 {chapter.chapter_number} 章 {chapter.title || '（未命名）'}
          </span>
          <div className="flex items-center gap-2">
            {chapter.plan_approved_at && <Badge variant="secondary">已核准</Badge>}
            {!chapter.plan && <Badge variant="outline">未規劃</Badge>}
            {chapter.plan && !chapter.plan_approved_at && <Badge variant="outline">待核准</Badge>}
            <Link
              to={`/novels/${novelId}/chapters/${chapter.id}/prose`}
              className="text-xs text-primary underline"
              onClick={(e) => e.stopPropagation()}
            >
              前往正文 →
            </Link>
          </div>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-1">
            <Label>本章指示</Label>
            <Textarea rows={2} value={direction} onChange={(e) => setDirection(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => generateMutation.mutate()}>
              {generateMutation.isPending ? '生成中…' : chapter.plan ? '重新生成' : '生成章節大綱'}
            </Button>
            {chapter.plan && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => reviseMutation.mutate()}>
                {reviseMutation.isPending ? '修改中…' : '保留歷史重新生成'}
              </Button>
            )}
          </div>

          {beats.length > 0 && (
            <div className="space-y-2">
              {beats.map((beat, i) => (
                <div key={i} className="rounded-md bg-muted px-3 py-2 text-sm">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      ch{chapter.chapter_number}-{i + 1}
                    </span>
                    <p className="font-medium">{beat.title}</p>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{beat.summary}</p>
                </div>
              ))}
              <Button
                size="sm"
                disabled={approveMutation.isPending || !!chapter.plan_approved_at}
                onClick={() => approveMutation.mutate()}
              >
                {chapter.plan_approved_at ? '已核准' : '核准此章節大綱'}
              </Button>
            </div>
          )}

          {(generateMutation.isError || reviseMutation.isError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {String((generateMutation.error ?? reviseMutation.error) as Error)}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function ChapterPlansStage({ novelId }: { novelId: string }) {
  const chaptersQuery = useQuery({
    queryKey: ['chapters', novelId],
    queryFn: () => chaptersApi.list(novelId),
  })
  const chapters = chaptersQuery.data ?? []
  const disabled = chapters.length === 0

  return (
    <div className={cn('space-y-4', disabled && 'pointer-events-none opacity-40')}>
      <SectionHeader index={3} title="章節大綱" done={chapters.some((c) => !!c.plan_approved_at)} />
      {disabled && <p className="text-sm text-muted-foreground">請先完成第二階段並套用至章節。</p>}
      <div className="max-w-3xl space-y-2">
        {chapters.map((chapter) => (
          <ChapterPlanRow key={chapter.id} novelId={novelId} chapter={chapter} />
        ))}
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ index, title, done }: { index: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
          done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {index}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function PlanningStudio() {
  const { novelId } = useParams<{ novelId: string }>()
  if (!novelId) return null

  return (
    <div className="space-y-10">
      <PremiseStage novelId={novelId} />
      <OutlineStage novelId={novelId} />
      <ChapterPlansStage novelId={novelId} />
    </div>
  )
}
