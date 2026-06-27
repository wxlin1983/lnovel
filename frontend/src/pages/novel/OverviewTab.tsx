import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { novelsApi } from '../../api/novels'
import { novelPremiseApi } from '../../api/novelPremise'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function OverviewTab() {
  const { novelId } = useParams<{ novelId: string }>()
  const queryClient = useQueryClient()
  const [titleDraft, setTitleDraft] = useState<string | null>(null)
  const [premiseDraft, setPremiseDraft] = useState<string | null>(null)
  const [inspirationDraft, setInspirationDraft] = useState<string | null>(null)
  const [premiseProposal, setPremiseProposal] = useState<string | null>(null)

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
      setTitleDraft(null)
      toast.success('已儲存書名')
    },
  })

  const updateNovelMutation = useMutation({
    mutationFn: (premise: string) => novelsApi.update(novelId!, { premise }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
      setPremiseDraft(null)
      toast.success('已儲存大綱')
    },
  })

  const generatePremiseMutation = useMutation({
    mutationFn: () => novelPremiseApi.generate(novelId!, { inspiration: inspirationDraft ?? undefined }),
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
      setInspirationDraft(null)
      setPremiseProposal(proposal.premise)
    },
  })

  if (!novelId || novelQuery.isLoading || !novelQuery.data) return null
  const novel = novelQuery.data

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>書名</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="title" className="sr-only">書名</Label>
          <Input
            id="title"
            value={titleDraft ?? novel.title}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && titleDraft && titleDraft.trim()) {
                updateTitleMutation.mutate(titleDraft.trim())
              }
            }}
          />
          <Button
            disabled={titleDraft === null || !titleDraft.trim() || updateTitleMutation.isPending}
            onClick={() => updateTitleMutation.mutate(titleDraft!.trim())}
          >
            儲存書名
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>靈感</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            輸入你的靈感片段，讓 AI 提案一段故事大綱（不會自動覆蓋下方大綱）。
          </p>
          <Textarea
            rows={2}
            placeholder="例如：一個會說話的貓在末日後的城市裡尋找最後一位人類"
            value={inspirationDraft ?? novel.inspiration}
            onChange={(e) => setInspirationDraft(e.target.value)}
          />
          <Button disabled={generatePremiseMutation.isPending} onClick={() => generatePremiseMutation.mutate()}>
            {generatePremiseMutation.isPending ? 'AI 生成中...' : '用 AI 生成故事大綱'}
          </Button>
          {generatePremiseMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>{(generatePremiseMutation.error as Error).message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {premiseProposal && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">AI 建議的故事大綱</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm whitespace-pre-wrap">{premiseProposal}</p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setPremiseDraft(premiseProposal)
                  setPremiseProposal(null)
                }}
              >
                套用到故事大綱
              </Button>
              <Button variant="ghost" onClick={() => setPremiseProposal(null)}>
                捨棄
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>故事大綱</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="premise" className="sr-only">
            故事大綱
          </Label>
          <Textarea
            id="premise"
            rows={5}
            value={premiseDraft ?? novel.premise}
            onChange={(e) => setPremiseDraft(e.target.value)}
          />
          <Button
            disabled={premiseDraft === null || updateNovelMutation.isPending}
            onClick={() => updateNovelMutation.mutate(premiseDraft!)}
          >
            儲存大綱
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
