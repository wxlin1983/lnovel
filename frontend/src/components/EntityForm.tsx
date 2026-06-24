import { useState } from 'react'
import type { Entity, EntityType } from '../api/types'

interface FieldRow {
  key: string
  value: string
}

function fieldsToRows(fields: Record<string, unknown>): FieldRow[] {
  const rows = Object.entries(fields).map(([key, value]) => ({ key, value: String(value) }))
  return rows.length > 0 ? rows : [{ key: '', value: '' }]
}

function rowsToFields(rows: FieldRow[]): Record<string, string> {
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
  const [type, setType] = useState<EntityType>(initial?.type ?? defaultType ?? 'character')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [rows, setRows] = useState<FieldRow[]>(fieldsToRows(initial?.fields ?? {}))

  return (
    <div className="space-y-3 rounded border p-4">
      {!initial && (
        <div className="flex gap-2">
          {(Object.keys(TYPE_LABELS) as EntityType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded px-3 py-1 text-sm ${type === t ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}
              onClick={() => setType(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      <input
        className="w-full rounded border px-3 py-2"
        placeholder="名稱"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <textarea
        className="w-full rounded border px-3 py-2"
        placeholder="描述"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">結構化欄位</p>
        {rows.map((row, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              className="w-1/3 rounded border px-2 py-1 text-sm"
              placeholder="欄位名稱"
              value={row.key}
              onChange={(e) => {
                const next = [...rows]
                next[idx] = { ...next[idx], key: e.target.value }
                setRows(next)
              }}
            />
            <input
              className="flex-1 rounded border px-2 py-1 text-sm"
              placeholder="內容"
              value={row.value}
              onChange={(e) => {
                const next = [...rows]
                next[idx] = { ...next[idx], value: e.target.value }
                setRows(next)
              }}
            />
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => setRows(rows.filter((_, i) => i !== idx))}
            >
              移除
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-purple-600"
          onClick={() => setRows([...rows, { key: '', value: '' }])}
        >
          + 新增欄位
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-purple-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={!name}
          onClick={() => onSubmit({ type, name, description, fields: rowsToFields(rows) })}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="rounded px-4 py-2 text-sm" onClick={onCancel}>
            取消
          </button>
        )}
      </div>
    </div>
  )
}
