import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { db } from '@/db/database'
import type { Topic, Item } from '@/types/schema'

interface TopicDetailProps {
  topicId: string
  onTopicClick?: (topicId: string) => void
}

export function TopicDetail({ topicId, onTopicClick }: TopicDetailProps) {
  const [topic, setTopic] = useState<Topic | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [connectedTopics, setConnectedTopics] = useState<Topic[]>([])

  useEffect(() => {
    const loadTopicAndItems = async () => {
      const topicData = await db.topics.get(topicId)
      if (topicData) {
        setTopic(topicData)
      }

      const itemTopics = await db.item_topic.where('topicId').equals(topicId).toArray()
      const itemIds = itemTopics.map(it => it.itemId)
      const itemsData = await db.items.where('id').anyOf(itemIds).toArray()
      itemsData.sort((a, b) => b.createdAt - a.createdAt)
      setItems(itemsData)

      const edges = await db.topic_edges.toArray()
      const connectedTopicIds = new Set<string>()
      edges.forEach(edge => {
        if (edge.src === topicId) connectedTopicIds.add(edge.dst)
        if (edge.dst === topicId) connectedTopicIds.add(edge.src)
      })

      const connectedTopicsData = await db.topics.where('id').anyOf(Array.from(connectedTopicIds)).toArray()
      connectedTopicsData.sort((a, b) => b.uses - a.uses)
      setConnectedTopics(connectedTopicsData)
    }

    loadTopicAndItems()
  }, [topicId])

  if (!topic) {
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

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <Card className="p-4">
        <div className="space-y-3">
          <div>
            <h2 className="text-2xl font-semibold">{topic.label}</h2>
          </div>

          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Uses:</span>{' '}
              <span className="font-medium">{topic.uses}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>{' '}
              <span className="font-medium">{formatDate(topic.createdAt)}</span>
            </div>
          </div>

          {topic.x !== undefined && topic.y !== undefined && topic.z !== undefined && (
            <div className="text-sm">
              <span className="text-muted-foreground">Position:</span>{' '}
              <span className="font-mono text-xs">
                ({topic.x.toFixed(2)}, {topic.y.toFixed(2)}, {topic.z.toFixed(2)})
              </span>
            </div>
          )}
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-medium mb-2 px-1">
          Linked Items ({items.length})
        </h3>
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <Card key={item.id} className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm">{item.title}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => window.open(item.link, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-sm text-muted-foreground">No linked items</p>
          </Card>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2 px-1">
          Connected Topics ({connectedTopics.length})
        </h3>
        {connectedTopics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {connectedTopics.map((connectedTopic) => (
              <Badge
                key={connectedTopic.id}
                variant="secondary"
                className="text-sm px-3 py-1 cursor-pointer hover:bg-accent"
                onClick={() => onTopicClick?.(connectedTopic.id)}
              >
                {connectedTopic.label}
                <span className="ml-2 text-xs text-muted-foreground">({connectedTopic.uses})</span>
              </Badge>
            ))}
          </div>
        ) : (
          <Card className="p-6">
            <p className="text-center text-sm text-muted-foreground">No connected topics</p>
          </Card>
        )}
      </div>
    </div>
  )
}
