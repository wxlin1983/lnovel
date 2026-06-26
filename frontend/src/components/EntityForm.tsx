import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Entity, EntityType } from '../api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const ENTITY_SCHEMA = z.object({
  type: z.enum(['character', 'location', 'storyline']),
  name: z.string().trim().min(1, '請輸入名稱'),
  description: z.string(),
  rows: z.array(z.object({ key: z.string(), value: z.string() })),
})

type EntityFormValues = z.infer<typeof ENTITY_SCHEMA>

function fieldsToRows(fields: Record<string, unknown>) {
  const rows = Object.entries(fields).map(([key, value]) => ({ key, value: String(value) }))
  return rows.length > 0 ? rows : [{ key: '', value: '' }]
}

function rowsToFields(rows: { key: string; value: string }[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const row of rows) {
    if (row.key.trim()) fields[row.key.trim()] = row.value
  }
  return fields
}

interface EntityFormProps {
  initial?: Entity
  defaultType?: EntityType
  onSubmit: (values: { type: EntityType; name: string; description: string; fields: Record<string, string> }) => void
  onCancel?: () => void
  submitLabel: string
}

const TYPE_LABELS: Record<EntityType, string> = {
  character: '角色',
  location: '地點',
  storyline: '故事線',
}

export function EntityForm({ initial, defaultType, onSubmit, onCancel, submitLabel }: EntityFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<EntityFormValues>({
    resolver: zodResolver(ENTITY_SCHEMA),
    defaultValues: {
      type: initial?.type ?? defaultType ?? 'character',
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      rows: fieldsToRows(initial?.fields ?? {}),
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'rows' })
  const type = watch('type')

  function submit(values: EntityFormValues) {
    onSubmit({ type: values.type, name: values.name, description: values.description, fields: rowsToFields(values.rows) })
  }

  return (
    <form className="space-y-3 rounded-lg border p-4" onSubmit={handleSubmit(submit)}>
      {!initial && (
        <div className="flex gap-2">
          {(Object.keys(TYPE_LABELS) as EntityType[]).map((t) => (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={type === t ? 'default' : 'secondary'}
              onClick={() => setValue('type', t)}
            >
              {TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="entity-name">名稱</Label>
        <Input id="entity-name" placeholder="名稱" {...register('name')} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="entity-description">描述</Label>
        <Textarea id="entity-description" placeholder="描述" rows={3} {...register('description')} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">結構化欄位</p>
        {fields.map((field, idx) => (
          <div key={field.id} className="flex gap-2">
            <Input className="w-1/3" placeholder="欄位名稱" {...register(`rows.${idx}.key`)} />
            <Input className="flex-1" placeholder="內容" {...register(`rows.${idx}.value`)} />
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => remove(idx)}>
              移除
            </Button>
          </div>
        ))}
        <Button type="button" variant="link" size="sm" className="px-0" onClick={() => append({ key: '', value: '' })}>
          + 新增欄位
        </Button>
      </div>

      <div className="flex gap-2">
        <Button type="submit">{submitLabel}</Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            取消
          </Button>
        )}
      </div>
    </form>
  )
}
