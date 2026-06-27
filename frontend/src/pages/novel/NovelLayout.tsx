import { useState } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Check, X } from 'lucide-react'
import { novelsApi } from '../../api/novels'
import { NovelTabNav } from './NovelTabNav'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function NovelLayout() {
  const { novelId } = useParams<{ novelId: string }>()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const novelQuery = useQuery({
    queryKey: ['novel', novelId],
    queryFn: () => novelsApi.get(novelId!),
    enabled: !!novelId,
  })

  const updateTitleMutation = useMutation({
    mutationFn: (title: string) => novelsApi.update(novelId!, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
      queryClient.invalidateQueries({ queryKey: ['novels'] })
      setEditing(false)
    },
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

  function startEdit() {
    setTitleDraft(novel.title)
    setEditing(true)
  }

  function confirmEdit() {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== novel.title) {
      updateTitleMutation.mutate(trimmed)
    } else {
      setEditing(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground hover:underline">小說列表</Link>
        <span>/</span>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-6 text-sm"
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmEdit()
                if (e.key === 'Escape') setEditing(false)
              }}
            />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={confirmEdit}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            className="flex items-center gap-1 text-foreground hover:underline"
            onClick={startEdit}
          >
            {novel.title}
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      <NovelTabNav novelId={novelId} />
      <div className="pt-6">
        <Outlet />
      </div>
    </div>
  )
}
