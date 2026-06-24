import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { settingsApi } from '../api/settings'
import { modelsApi } from '../api/models'
import type { Provider } from '../api/types'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get })
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('')
  const [provider, setProvider] = useState<Provider | ''>('')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('')

  const effectiveProvider = provider || data?.provider
  const hasChanges = provider !== '' || apiKey !== '' || model !== '' || ollamaBaseUrl !== ''

  const { data: modelOptions, isLoading: modelsLoading } = useQuery({
    queryKey: ['models', effectiveProvider],
    queryFn: () => modelsApi.list(effectiveProvider),
    enabled: !!effectiveProvider,
    staleTime: 60 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['models'] })
      resetDrafts()
    },
  })

  const clearKeyMutation = useMutation({
    mutationFn: () => settingsApi.update({ openrouter_api_key: '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  const testConnection = useMutation({
    mutationFn: () => modelsApi.test('ollama', ollamaBaseUrl || data?.ollama_base_url),
  })

  function resetDrafts() {
    setProvider('')
    setApiKey('')
    setModel('')
    setOllamaBaseUrl('')
    setShowKey(false)
    testConnection.reset()
  }

  function handleProviderChange(next: Provider) {
    setProvider(next)
    // Drop any unsaved draft from the other provider so it can't be submitted by mistake,
    // and so switching back and forth doesn't show stale leftover text.
    setApiKey('')
    setOllamaBaseUrl('')
    setModel('')
    testConnection.reset()
  }

  if (isLoading || !data) return <p className="p-6">載入中...</p>

  const currentProvider = provider || data.provider
  const modelMissing = !modelsLoading && !modelOptions?.some((m) => m.id === data.preferred_model)

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <Link to="/" className="text-sm text-purple-600 underline">
        ← 返回小說列表
      </Link>

      <h1 className="text-2xl font-semibold">設定</h1>

      <div className="space-y-4 rounded border p-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">AI 服務提供者</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={currentProvider}
            onChange={(e) => handleProviderChange(e.target.value as Provider)}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="ollama">本地 Ollama</option>
          </select>
        </div>

        {currentProvider === 'openrouter' ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium">OpenRouter API Key</label>
            <p className="text-sm text-gray-500">
              目前狀態：{data.has_key ? '已設定金鑰' : '尚未設定金鑰'}
            </p>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-or-..."
                className="w-full rounded border px-3 py-2"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                className="shrink-0 rounded border px-3 text-sm text-gray-600"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? '隱藏' : '顯示'}
              </button>
            </div>
            {data.has_key && (
              <button
                type="button"
                className="text-sm text-red-600 underline disabled:opacity-50"
                disabled={clearKeyMutation.isPending}
                onClick={() => {
                  if (window.confirm('確定要清除已儲存的 API Key 嗎？')) clearKeyMutation.mutate()
                }}
              >
                清除金鑰
              </button>
            )}
            {clearKeyMutation.isError && (
              <p className="text-sm text-red-600">{(clearKeyMutation.error as Error).message}</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Ollama 位址</label>
            <p className="text-sm text-gray-500">本地 Ollama 不需要 API 金鑰，但容器需能連到此位址。</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="http://host.docker.internal:11434"
                className="w-full rounded border px-3 py-2"
                value={ollamaBaseUrl || data.ollama_base_url}
                onChange={(e) => {
                  setOllamaBaseUrl(e.target.value)
                  testConnection.reset()
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded border px-3 text-sm text-gray-600 disabled:opacity-50"
                disabled={testConnection.isPending}
                onClick={() => testConnection.mutate()}
              >
                {testConnection.isPending ? '測試中...' : '測試連線'}
              </button>
            </div>
            {testConnection.isSuccess && (
              <p className="text-sm text-green-600">
                ✓ 連線成功，找到 {testConnection.data.length} 個模型
              </p>
            )}
            {testConnection.isError && (
              <p className="text-sm text-red-600">✕ {(testConnection.error as Error).message}</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-medium">偏好模型</label>
          <select
            className="w-full rounded border px-3 py-2"
            value={model || data.preferred_model}
            onChange={(e) => setModel(e.target.value)}
            disabled={modelsLoading}
          >
            {!modelOptions?.some((m) => m.id === data.preferred_model) && (
              <option value={data.preferred_model}>{data.preferred_model}</option>
            )}
            {modelOptions?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {modelsLoading
              ? '正在取得模型清單...'
              : currentProvider === 'openrouter'
                ? '清單來自 OpenRouter 目前的免費模型；若選用的模型回報需要付費，系統會自動嘗試清單中的其他免費模型。'
                : '清單來自本地 Ollama 已安裝的模型；若選用的模型尚未安裝，系統會自動嘗試其他已安裝的模型。'}
          </p>
          {modelMissing && (
            <p className="text-xs text-amber-600">
              ⚠ 目前設定的模型「{data.preferred_model}」不在清單中，可能已下架或尚未安裝，建議重新選擇。
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded bg-purple-600 px-4 py-2 text-white disabled:opacity-50"
          disabled={mutation.isPending || !hasChanges}
          onClick={() =>
            mutation.mutate({
              ...(provider ? { provider } : {}),
              ...(apiKey ? { openrouter_api_key: apiKey } : {}),
              ...(model ? { preferred_model: model } : {}),
              ...(ollamaBaseUrl ? { ollama_base_url: ollamaBaseUrl } : {}),
            })
          }
        >
          {mutation.isPending ? '儲存中...' : '儲存設定'}
        </button>
        {hasChanges && (
          <button type="button" className="text-sm text-gray-500 underline" onClick={resetDrafts}>
            取消
          </button>
        )}
        {mutation.isSuccess && <span className="text-sm text-green-600">已儲存</span>}
        {mutation.isError && <span className="text-sm text-red-600">{(mutation.error as Error).message}</span>}
      </div>
    </div>
  )
}
