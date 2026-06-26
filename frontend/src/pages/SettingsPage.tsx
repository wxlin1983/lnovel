import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { settingsApi } from '../api/settings'
import { modelsApi } from '../api/models'
import type { Provider } from '../api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { PageLoading } from '@/components/PageLoading'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get })
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [model, setModel] = useState('')
  const [provider, setProvider] = useState<Provider | ''>('')
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('')
  const [confirmClearKey, setConfirmClearKey] = useState(false)

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
      toast.success('已儲存設定')
    },
  })

  const clearKeyMutation = useMutation({
    mutationFn: () => settingsApi.update({ openrouter_api_key: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setConfirmClearKey(false)
      toast.success('已清除金鑰')
    },
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

  if (isLoading || !data) return <PageLoading />

  const currentProvider = provider || data.provider
  const modelMissing = !modelsLoading && !modelOptions?.some((m) => m.id === data.preferred_model)

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-2xl font-semibold">設定</h1>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>AI 服務提供者</Label>
            <Select value={currentProvider} onValueChange={(v) => handleProviderChange(v as Provider)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="ollama">本地 Ollama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {currentProvider === 'openrouter' ? (
            <div className="space-y-2">
              <Label htmlFor="api-key">OpenRouter API Key</Label>
              <p className="text-sm text-muted-foreground">目前狀態：{data.has_key ? '已設定金鑰' : '尚未設定金鑰'}</p>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-or-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Button type="button" variant="outline" className="shrink-0" onClick={() => setShowKey((v) => !v)}>
                  {showKey ? '隱藏' : '顯示'}
                </Button>
              </div>
              {data.has_key && (
                <button
                  type="button"
                  className="text-sm text-destructive underline disabled:opacity-50"
                  disabled={clearKeyMutation.isPending}
                  onClick={() => setConfirmClearKey(true)}
                >
                  清除金鑰
                </button>
              )}
              {clearKeyMutation.isError && (
                <Alert variant="destructive">
                  <AlertDescription>{(clearKeyMutation.error as Error).message}</AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="ollama-url">Ollama 位址</Label>
              <p className="text-sm text-muted-foreground">本地 Ollama 不需要 API 金鑰，但容器需能連到此位址。</p>
              <div className="flex gap-2">
                <Input
                  id="ollama-url"
                  type="text"
                  placeholder="http://host.docker.internal:11434"
                  value={ollamaBaseUrl || data.ollama_base_url}
                  onChange={(e) => {
                    setOllamaBaseUrl(e.target.value)
                    testConnection.reset()
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={testConnection.isPending}
                  onClick={() => testConnection.mutate()}
                >
                  {testConnection.isPending ? '測試中...' : '測試連線'}
                </Button>
              </div>
              {testConnection.isSuccess && (
                <p className="text-sm text-green-600">✓ 連線成功，找到 {testConnection.data.length} 個模型</p>
              )}
              {testConnection.isError && (
                <Alert variant="destructive">
                  <AlertDescription>✕ {(testConnection.error as Error).message}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>偏好模型</Label>
            <Select value={model || data.preferred_model} onValueChange={setModel} disabled={modelsLoading}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!modelOptions?.some((m) => m.id === data.preferred_model) && (
                  <SelectItem value={data.preferred_model}>{data.preferred_model}</SelectItem>
                )}
                {modelOptions?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
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
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
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
        </Button>
        {hasChanges && (
          <Button type="button" variant="ghost" onClick={resetDrafts}>
            取消
          </Button>
        )}
        {mutation.isError && (
          <span className="text-sm text-destructive">{(mutation.error as Error).message}</span>
        )}
      </div>

      <AlertDialog open={confirmClearKey} onOpenChange={setConfirmClearKey}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清除已儲存的 API Key？</AlertDialogTitle>
            <AlertDialogDescription>清除後，使用 OpenRouter 生成內容前需要重新輸入金鑰。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => clearKeyMutation.mutate()}>清除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
