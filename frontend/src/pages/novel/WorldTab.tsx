import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { entitiesApi } from '../../api/entities'
import type { Entity, EntityType } from '../../api/types'
import { EntityForm } from '../../components/EntityForm'
import { EntityChatPanel } from '../../components/EntityChatPanel'
import { Button } from '@/components/ui/button'
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

const TYPE_LABELS: Record<EntityType, string> = {
  character: '角色',
  location: '地點',
  storyline: '故事線',
}

const TYPE_PREFIX: Record<EntityType, string> = {
  character: 'chr',
  location: 'loc',
  storyline: 'stl',
}

export function WorldTab() {
  const { novelId } = useParams<{ novelId: string }>()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [chattingId, setChattingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const entitiesQuery = useQuery({
    queryKey: ['entities', novelId],
    queryFn: () => entitiesApi.list(novelId!),
    enabled: !!novelId,
  })

  const createEntityMutation = useMutation({
    mutationFn: entitiesApi.create.bind(null, novelId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', novelId] })
      setShowCreate(false)
      toast.success('已新增條目')
    },
  })

  const updateEntityMutation = useMutation({
    mutationFn: ({ entityId, ...payload }: { entityId: string; name: string; description: string; fields: Record<string, string> }) =>
      entitiesApi.update(novelId!, entityId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', novelId] })
      setEditingId(null)
      toast.success('已儲存')
    },
  })

  const deleteEntityMutation = useMutation({
    mutationFn: (entityId: string) => entitiesApi.remove(novelId!, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', novelId] })
      setDeletingId(null)
      toast.success('已刪除')
    },
  })

  if (!novelId) return null

  const entities = entitiesQuery.data ?? []
  const grouped = (Object.keys(TYPE_LABELS) as EntityType[]).map((type) => ({
    type,
    items: entities.filter((e) => e.type === type),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">世界觀設定</h2>
        <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? '取消新增' : '+ 新增條目'}</Button>
      </div>

      {showCreate && (
        <EntityForm submitLabel="建立" onCancel={() => setShowCreate(false)} onSubmit={(values) => createEntityMutation.mutate(values)} />
      )}

      {entities.length === 0 && !showCreate ? (
        <EmptyState icon={Users} title="尚無世界觀設定" description="新增角色、地點或故事線，AI 生成大綱與正文時會參考這些設定。" />
      ) : (
        grouped.map(({ type, items }) => (
          <div key={type} className="space-y-2">
            <h3 className="font-medium text-muted-foreground">{TYPE_LABELS[type]}</h3>
            {items.length === 0 && <p className="text-sm text-muted-foreground">尚無{TYPE_LABELS[type]}</p>}
            <ul className="space-y-2">
              {items.map((entity: Entity, idx: number) => (
                <li key={entity.id} className="rounded-lg border p-3">
                  {editingId === entity.id ? (
                    <EntityForm
                      initial={entity}
                      submitLabel="儲存"
                      onCancel={() => setEditingId(null)}
                      onSubmit={(values) => updateEntityMutation.mutate({ entityId: entity.id, ...values })}
                    />
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                            {TYPE_PREFIX[type]}{idx + 1}
                          </span>
                          <p className="font-medium">{entity.name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{entity.description}</p>
                      </div>
                      <div className="flex gap-3 text-sm">
                        <button
                          className="text-primary hover:underline"
                          onClick={() => setChattingId(chattingId === entity.id ? null : entity.id)}
                        >
                          {chattingId === entity.id ? '關閉討論' : '與 AI 討論'}
                        </button>
                        <button className="text-primary hover:underline" onClick={() => setEditingId(entity.id)}>
                          編輯
                        </button>
                        <button className="text-destructive hover:underline" onClick={() => setDeletingId(entity.id)}>
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
        ))
      )}

      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除這個條目？</AlertDialogTitle>
            <AlertDialogDescription>此操作無法復原，相關的 AI 討論紀錄也會一併刪除。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteEntityMutation.mutate(deletingId)}>刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
