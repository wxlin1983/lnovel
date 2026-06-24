import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { novelsApi } from '../api/novels'

export function NovelsListPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['novels'], queryFn: novelsApi.list })
  const [title, setTitle] = useState('')

  const createMutation = useMutation({
    mutationFn: novelsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novels'] })
      setTitle('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: novelsApi.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['novels'] }),
  })

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">我的小說</h1>
        <Link to="/settings" className="text-sm text-purple-600 underline">
          設定
        </Link>
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-3 py-2"
          placeholder="新小說標題"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          className="rounded bg-purple-600 px-4 py-2 text-white disabled:opacity-50"
          disabled={!title || createMutation.isPending}
          onClick={() => createMutation.mutate({ title })}
        >
          建立
        </button>
      </div>

      {isLoading && <p>載入中...</p>}

      <ul className="divide-y rounded border">
        {data?.map((novel) => (
          <li key={novel.id} className="flex items-center justify-between p-4">
            <Link to={`/novels/${novel.id}`} className="font-medium hover:underline">
              {novel.title}
            </Link>
            <button
              className="text-sm text-red-600"
              onClick={() => deleteMutation.mutate(novel.id)}
            >
              刪除
            </button>
          </li>
        ))}
        {data?.length === 0 && <li className="p-4 text-gray-500">尚無小說，請先建立一本。</li>}
      </ul>
    </div>
  )
}
