import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { chaptersApi } from '../../api/chapters'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'

const STATUS_LABELS = { planned: '規劃中', drafted: '草稿', final: '完稿' } as const

export function FullTextTab() {
  const { novelId } = useParams<{ novelId: string }>()

  const chaptersQuery = useQuery({
    queryKey: ['chapters', novelId],
    queryFn: () => chaptersApi.list(novelId!),
    enabled: !!novelId,
  })

  const chapters = chaptersQuery.data ?? []
  const withProse = chapters.filter((c) => c.prose)

  if (chapters.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="尚無章節"
        description="完成規劃室的流程並生成正文後，即可在此閱讀全文。"
      />
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-12">
      {chapters.map((chapter) => (
        <section key={chapter.id} id={`ch-${chapter.chapter_number}`}>
          <div className="mb-4 flex items-baseline justify-between border-b pb-2">
            <h2 className="text-xl font-semibold">
              <span className="mr-2 font-mono text-sm text-muted-foreground">
                {chapter.chapter_number}
              </span>
              第 {chapter.chapter_number} 章{chapter.title ? `　${chapter.title}` : ''}
            </h2>
            <div className="flex items-center gap-2">
              <Badge
                variant={chapter.status === 'final' ? 'secondary' : 'outline'}
                className={chapter.status === 'final' ? 'bg-green-600/10 text-green-700' : ''}
              >
                {STATUS_LABELS[chapter.status]}
              </Badge>
              <Link
                to={`/novels/${novelId}/chapters/${chapter.id}/prose`}
                className="text-xs text-primary underline hover:no-underline"
              >
                編輯
              </Link>
            </div>
          </div>

          {chapter.prose ? (
            <>
              {/* Beat reference markers in margin if plan exists */}
              {chapter.plan && chapter.plan.beats.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {chapter.plan.beats.map((beat, i) => (
                    <span
                      key={i}
                      title={beat.title}
                      className="cursor-default rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                      ch{chapter.chapter_number}-{i + 1}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-base leading-8 whitespace-pre-wrap">{chapter.prose}</p>
            </>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              尚未生成正文。
              {chapter.plan_approved_at ? (
                <Link
                  to={`/novels/${novelId}/chapters/${chapter.id}/prose`}
                  className="ml-1 text-primary underline"
                >
                  前往生成 →
                </Link>
              ) : (
                <span className="ml-1">請先在規劃室核准章節大綱。</span>
              )}
            </p>
          )}
        </section>
      ))}

      {withProse.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          所有章節尚無正文。前往
          <Link to={`/novels/${novelId}`} className="text-primary underline">規劃室</Link>
          核准大綱後即可生成。
        </p>
      )}
    </div>
  )
}
