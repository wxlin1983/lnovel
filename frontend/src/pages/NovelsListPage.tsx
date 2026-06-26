import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BookText } from 'lucide-react'
import { novelsApi } from '../api/novels'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from '@/components/ui/alert-dialog'

export function NovelsListPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['novels'], queryFn: novelsApi.list })
  const [title, setTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: novelsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novels'] })
      setTitle('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: novelsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novels'] })
      setDeletingId(null)
      toast.success('已刪除小說')
    },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">我的小說</h1>

      <div className="flex gap-2">
        <Input
          placeholder="新小說標題"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title) createMutation.mutate({ title })
          }}
        />
        <Button disabled={!title || createMutation.isPending} onClick={() => createMutation.mutate({ title })}>
          建立
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">載入中...</p>}

      {data?.length === 0 ? (
        <EmptyState icon={BookText} title="尚無小說" description="在上方輸入標題，建立你的第一本小說。" />
      ) : (
        <div className="space-y-2">
          {data?.map((novel) => (
            <Card key={novel.id}>
              <CardContent className="flex items-center justify-between">
                <Link to={`/novels/${novel.id}`} className="font-medium hover:underline">
                  {novel.title}
                </Link>
                <button className="text-sm text-destructive hover:underline" onClick={() => setDeletingId(novel.id)}>
                  刪除
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這本小說？</AlertDialogTitle>
            <AlertDialogDescription>此操作無法復原，小說的所有條目、章節與大綱都會一併刪除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)}>刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
