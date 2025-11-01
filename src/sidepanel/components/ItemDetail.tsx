import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { db } from '@/db/database'
import type { Topic, Item } from '@/types/schema'

interface ItemDetailProps {
  itemId: string
}

export function ItemDetail({ itemId }: ItemDetailProps) {
  const [item, setItem] = useState<Item | null>(null)
  const [topics, setTopics] = useState<Topic[]>([])

  useEffect(() => {
    const loadItemAndTopics = async () => {
      const itemData = await db.items.get(itemId)
      if (itemData) {
        setItem(itemData)
      }

      const itemTopics = await db.item_topic.where('itemId').equals(itemId).toArray()
      const topicIds = itemTopics.map(it => it.topicId)
      const topicsData = await db.topics.where('id').anyOf(topicIds).toArray()
      topicsData.sort((a, b) => b.uses - a.uses)
      setTopics(topicsData)
    }

    loadItemAndTopics()
  }, [itemId])

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatSummary = (summary: string) => {
    const bulletPoints = summary.split('* ').filter(point => point.trim())

    if (bulletPoints.length <= 1) {
      return <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
    }

    return (
      <ul className="space-y-3">
        {bulletPoints.map((point, index) => (
          <li key={index} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
            <span className="text-foreground shrink-0">•</span>
            <span>{point.trim()}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => window.open(item.link, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open
            </Button>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Created:</span>{' '}
            <span className="font-medium">{formatDate(item.createdAt)}</span>
          </div>

          <div className="pt-2">
            <h3 className="text-sm font-medium mb-2">Summary</h3>
            {formatSummary(item.summary)}
          </div>
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2 px-1">
          Linked Topics ({topics.length})
        </h3>
        {topics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <Badge key={topic.id} variant="secondary" className="text-sm px-3 py-1">
                {topic.label}
                <span className="ml-2 text-xs text-muted-foreground">({topic.uses})</span>
              </Badge>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-sm text-muted-foreground">No linked topics</p>
          </Card>
        )}
      </div>
    </div>
  )
}
