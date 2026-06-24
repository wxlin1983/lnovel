import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '../api/settings'

const FREE_MODELS = [
  'qwen/qwen-2.5-72b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
]

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get })
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')

  const mutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setApiKey('')
    },
  })

  if (isLoading || !data) return <p className="p-6">載入中...</p>

  return (
    <div className="mx-auto max-w-lg p-6 space-y-6">
      <h1 className="text-2xl font-semibold">設定</h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">OpenRouter API Key</label>
        <p className="text-sm text-gray-500">
          目前狀態：{data.has_key ? '已設定金鑰' : '尚未設定金鑰'}
        </p>
        <input
          type="password"
          placeholder="sk-or-..."
          className="w-full rounded border px-3 py-2"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">偏好模型</label>
        <select
          className="w-full rounded border px-3 py-2"
          value={model || data.preferred_model}
          onChange={(e) => setModel(e.target.value)}
        >
          {FREE_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <button
        className="rounded bg-purple-600 px-4 py-2 text-white disabled:opacity-50"
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate({
            ...(apiKey ? { openrouter_api_key: apiKey } : {}),
            ...(model ? { preferred_model: model } : {}),
          })
        }
      >
        儲存設定
      </button>
    </div>
  )
}
