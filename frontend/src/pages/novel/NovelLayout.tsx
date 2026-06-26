import { Link, Outlet, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { novelsApi } from '../../api/novels'
import { NovelTabNav } from './NovelTabNav'
import { Skeleton } from '@/components/ui/skeleton'

export function NovelLayout() {
  const { novelId } = useParams<{ novelId: string }>()

  const novelQuery = useQuery({
    queryKey: ['novel', novelId],
    queryFn: () => novelsApi.get(novelId!),
    enabled: !!novelId,
  })

  if (!novelId) return null

  if (novelQuery.isLoading || !novelQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }

  const novel = novelQuery.data

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground hover:underline">
          小說列表
        </Link>
        <span>/</span>
        <span className="text-foreground">{novel.title}</span>
      </div>
      <NovelTabNav novelId={novelId} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  )
}
