import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Network, FileText, Link2, Clock, TrendingUp } from 'lucide-react'
import { db } from '@/db/database'
import { formatDistanceToNow } from '@/lib/time'

interface Stats {
  topicCount: number
  itemCount: number
  edgeCount: number
  lastUpdated: number | null
  recentCount: number
}

export function GraphStats() {
  const [stats, setStats] = useState<Stats>({
    topicCount: 0,
    itemCount: 0,
    edgeCount: 0,
    lastUpdated: null,
    recentCount: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()

    const interval = setInterval(loadStats, 3000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      const [topicCount, itemCount, edgeCount] = await Promise.all([
        db.topics.count(),
        db.items.count(),
        db.topic_edges.count(),
      ])

      const lastItem = await db.items.orderBy('createdAt').reverse().limit(1).toArray()
      const lastUpdated = lastItem[0]?.createdAt || null

      const oneDayAgo = Date.now() - 86400000
      const recentCount = await db.items.where('createdAt').above(oneDayAgo).count()

      setStats({
        topicCount,
        itemCount,
        edgeCount,
        lastUpdated,
        recentCount,
      })
    } catch (error) {
      console.error('[GraphStats] Failed to load stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topicCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.itemCount}</div>
            {stats.recentCount > 0 && (
              <Badge variant="secondary" className="mt-1 text-xs gap-1">
                <TrendingUp className="h-3 w-3" />
                +{stats.recentCount} today
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Edges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.edgeCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Updated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats.lastUpdated ? formatDistanceToNow(stats.lastUpdated) : 'Never'}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
