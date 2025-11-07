import { useState, useEffect } from 'react'
import { ExtractControl } from '@/components/ExtractControl'
import { useExtraction } from '@/hooks/useExtraction'
import { ViewSelector } from './components/ViewSelector'
import { ThemeToggle } from '@/components/ThemeToggle'
import { StatsBar } from './components/StatsBar'
import { ExploreInput } from './components/ExploreInput'
import { ItemCard } from './components/ItemCard'
import { InspectView } from './components/InspectView'
import { ConfigureView } from './components/ConfigureView'
import { GraphView } from './components/GraphView'
import { InsightStream } from './components/InsightStream'
import { StarMap } from '@/components/StarMap'
import { db, ORION_GRAPH_ID } from '@/db/database'
import { getLastUsedGraphId, setCurrentGraphId } from '@/services/graphManager'
import type { TopicWithPosition, TopicEdge, Item } from '@/types/schema'
import type { TopicSearchResult } from '@/services/search'
import { getItemsForTopic } from '@/services/graph'
import { performRAGSearch } from '@/services/searchOrchestrator'

export default function App() {
  const extraction = useExtraction()
  const [view, setView] = useState<'explore' | 'inspect' | 'configure' | 'graphs'>('explore')
  const [graphId, setGraphId] = useState<string>(ORION_GRAPH_ID)
  const [topics, setTopics] = useState<TopicWithPosition[]>([])
  const [highlightedTopics, setHighlightedTopics] = useState<TopicSearchResult[] | undefined>()
  const [edges, setEdges] = useState<TopicEdge[] | undefined>()
  const [selectedTopic, setSelectedTopic] = useState<TopicWithPosition | null>(null)
  const [topicItems, setTopicItems] = useState<Item[]>([])
  const [insightStream, setInsightStream] = useState<ReadableStream<string> | null>(null)
  const [insightItemMap, setInsightItemMap] = useState<Map<string, string>>(new Map())
  const [isWaitingForInsight, setIsWaitingForInsight] = useState(false)
  const [showingAllEdges, setShowingAllEdges] = useState(false)
  const [showingAllLabels, setShowingAllLabels] = useState(false)
  const [showingClusters, setShowingClusters] = useState(false)
  const [clusterCount, setClusterCount] = useState(0)
  const [flashMessage, setFlashMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  useEffect(() => {
    getLastUsedGraphId().then(id => setGraphId(id))
  }, [])

  useEffect(() => {
    if (!graphId) return

    const loadTopics = async () => {
      const allTopics = await db.topics.where('graphId').equals(graphId).toArray()
      const withPositions = allTopics.filter(
        (t): t is TopicWithPosition =>
          t.x !== undefined && t.y !== undefined && t.z !== undefined
      )
      setTopics(withPositions)
    }

    loadTopics()

    const interval = setInterval(loadTopics, 2000)

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.lastInsertionTime || changes.current_graph_id) {
        loadTopics()
      }
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      clearInterval(interval)
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [graphId])

  useEffect(() => {
    if (highlightedTopics && highlightedTopics.length > 0) {
      handleClear()
    }
  }, [topics.length])

  useEffect(() => {
    if (view === 'explore' && highlightedTopics && highlightedTopics.length > 0) {
      handleClear()
    }
  }, [view])

  const handleSearch = async (query: string) => {
    try {
      setIsWaitingForInsight(true)

      const response = await chrome.runtime.sendMessage({
        type: 'GET_EMBEDDING',
        text: query,
        format: 'query'
      })

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to get embedding')
      }

      const result = await performRAGSearch(graphId, response.embedding, query, topics)

      setHighlightedTopics(result.highlightedTopics)
      setEdges(result.edges)
      setInsightStream(result.insightStream)
      setInsightItemMap(result.itemMap)

      // Disable all modes when we have highlighted nodes
      if (result.highlightedTopics && result.highlightedTopics.length > 0) {
        setShowingAllEdges(false)
        setShowingClusters(false)
      }
    } catch (error) {
      console.error('[explore] Search error:', error)
    }
  }

  const handleClear = () => {
    setHighlightedTopics(undefined)
    setEdges(undefined)
    setInsightStream(null)
    setInsightItemMap(new Map())
    setIsWaitingForInsight(false)
  }

  const handleCloseInsight = () => {
    setInsightStream(null)
    setInsightItemMap(new Map())
    setIsWaitingForInsight(false)
    setHighlightedTopics(undefined)
    setEdges(undefined)
  }

  const handleTopicClick = async (topic: TopicWithPosition) => {
    setSelectedTopic(topic)
    const items = await getItemsForTopic(graphId, topic.id)
    setTopicItems(items)
  }

  const handleCloseCard = () => {
    setSelectedTopic(null)
    setTopicItems([])
  }

  const handleToggleEdges = async () => {
    // Don't allow toggling if highlights are active
    if (highlightedTopics && highlightedTopics.length > 0) return

    if (showingAllEdges) {
      setEdges(undefined)
      setHighlightedTopics(undefined)
      setShowingAllEdges(false)
    } else {
      const allEdges = await db.topic_edges.where('graphId').equals(graphId).toArray()
      setEdges(allEdges)
      setShowingAllEdges(true)
      setShowingClusters(false)
    }
  }

  const handleToggleLabels = () => {
    setShowingAllLabels(!showingAllLabels)
  }

  const handleToggleClusters = () => {
    // Don't allow toggling if highlights are active
    if (highlightedTopics && highlightedTopics.length > 0) return

    if (showingClusters) {
      setShowingClusters(false)
    } else {
      setShowingClusters(true)
      setShowingAllEdges(false)
      setEdges(undefined)
      setHighlightedTopics(undefined)
    }
  }

  const showFlash = (type: 'success' | 'error', message: string) => {
    setFlashMessage({ type, message })
  }

  const handleGraphSwitch = async (newGraphId: string) => {
    await setCurrentGraphId(newGraphId)
    setGraphId(newGraphId)
    setView('explore')
  }

  useEffect(() => {
    if (flashMessage) {
      const timer = setTimeout(() => {
        setFlashMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [flashMessage])

  const displayStatus = flashMessage
    ? { type: flashMessage.type, message: flashMessage.message }
    : extraction.status

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-2.5 border-b">
        <ViewSelector graphId={graphId} value={view} onValueChange={setView} />
        <div className="flex items-center gap-1.5">
          <ExtractControl extraction={extraction} compact />
          <ThemeToggle />
        </div>
      </header>

      <StatsBar
        status={displayStatus}
        onEdgeClick={handleToggleEdges}
        showingEdges={showingAllEdges}
        onTopicClick={handleToggleLabels}
        showingAllLabels={showingAllLabels}
        onClusterClick={handleToggleClusters}
        showingClusters={showingClusters}
        clusterCount={clusterCount}
      />

      <div className="flex-1 overflow-hidden relative">
        {view === 'explore' ? (
          <>
            <div className="absolute inset-0">
              <StarMap
                graphId={graphId}
                topics={topics}
                highlightedTopics={highlightedTopics}
                edges={edges}
                onTopicClick={handleTopicClick}
                showAllLabels={showingAllLabels}
                showClusters={showingClusters}
                onClusterCountChange={setClusterCount}
              />
            </div>
            {(isWaitingForInsight || insightStream) && (
              <div className="absolute top-0 left-0 right-0 z-[9998]">
                <InsightStream
                  stream={insightStream}
                  isWaiting={isWaitingForInsight}
                  itemMap={insightItemMap}
                  onClose={handleCloseInsight}
                  onComplete={() => setIsWaitingForInsight(false)}
                />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none flex flex-col-reverse gap-3 z-[9999]">
              <div className="pointer-events-auto">
                <ExploreInput
                  onSearch={handleSearch}
                  onInputChange={handleClear}
                  isSearching={false}
                  hasResults={highlightedTopics !== undefined && highlightedTopics.length > 0}
                />
              </div>
              {selectedTopic && (
                <div className="pointer-events-auto">
                  <ItemCard
                    topic={selectedTopic}
                    items={topicItems}
                    onClose={handleCloseCard}
                  />
                </div>
              )}
            </div>
          </>
        ) : view === 'inspect' ? (
          <InspectView graphId={graphId} />
        ) : view === 'configure' ? (
          <ConfigureView graphId={graphId} onFlash={showFlash} />
        ) : (
          <GraphView onGraphSwitch={handleGraphSwitch} />
        )}
      </div>
    </div>
  )
}
