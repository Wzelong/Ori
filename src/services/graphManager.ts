import { db, ORION_GRAPH_ID } from '@/db/database'
import type { Graph } from '@/types/schema'

const CURRENT_GRAPH_KEY = 'current_graph_id'
const LAST_USED_GRAPH_KEY = 'last_used_graph_id'

export async function initializeGraphs(): Promise<void> {
  const orionExists = await db.graphs.get(ORION_GRAPH_ID)

  if (!orionExists) {
    await db.graphs.add({
      id: ORION_GRAPH_ID,
      name: 'Orion',
      createdAt: Date.now(),
      isDefault: true
    })
  }

  const currentGraphId = await getCurrentGraphId()
  if (!currentGraphId) {
    await setCurrentGraphId(ORION_GRAPH_ID)
  }
}

export async function createGraph(name: string): Promise<string> {
  const graphId = `graph_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  const newGraph: Graph = {
    id: graphId,
    name,
    createdAt: Date.now(),
    isDefault: false
  }

  await db.graphs.add(newGraph)

  console.log(`[GraphManager] Created graph: ${name} (${graphId})`)
  return graphId
}

export async function resetGraph(graphId: string): Promise<void> {
  await db.transaction('rw', [db.topics, db.items, db.item_topic, db.topic_edges, db.vectors], async () => {
    await db.topics.where('graphId').equals(graphId).delete()
    await db.items.where('graphId').equals(graphId).delete()
    await db.item_topic.where('graphId').equals(graphId).delete()
    await db.topic_edges.where('graphId').equals(graphId).delete()
    await db.vectors.where('graphId').equals(graphId).delete()
  })

  console.log(`[GraphManager] Reset graph: ${graphId}`)
}

export async function deleteGraph(graphId: string): Promise<void> {
  if (graphId === ORION_GRAPH_ID) {
    throw new Error('Cannot delete the default Orion graph')
  }

  await db.transaction('rw', [db.graphs, db.topics, db.items, db.item_topic, db.topic_edges, db.vectors], async () => {
    await db.topics.where('graphId').equals(graphId).delete()
    await db.items.where('graphId').equals(graphId).delete()
    await db.item_topic.where('graphId').equals(graphId).delete()
    await db.topic_edges.where('graphId').equals(graphId).delete()
    await db.vectors.where('graphId').equals(graphId).delete()
    await db.graphs.delete(graphId)
  })

  const currentGraphId = await getCurrentGraphId()
  if (currentGraphId === graphId) {
    await setCurrentGraphId(ORION_GRAPH_ID)
  }

  console.log(`[GraphManager] Deleted graph: ${graphId}`)
}

export async function listGraphs(): Promise<Graph[]> {
  return await db.graphs.orderBy('createdAt').toArray()
}

export async function getGraph(graphId: string): Promise<Graph | undefined> {
  return await db.graphs.get(graphId)
}

export async function getCurrentGraphId(): Promise<string | null> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const result = await chrome.storage.local.get(CURRENT_GRAPH_KEY)
    return result[CURRENT_GRAPH_KEY] || null
  }
  return null
}

export async function setCurrentGraphId(graphId: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set({
      [CURRENT_GRAPH_KEY]: graphId,
      [LAST_USED_GRAPH_KEY]: graphId
    })
    console.log(`[GraphManager] Switched to graph: ${graphId}`)
  }
}

export async function getLastUsedGraphId(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    const result = await chrome.storage.local.get(LAST_USED_GRAPH_KEY)
    return result[LAST_USED_GRAPH_KEY] || ORION_GRAPH_ID
  }
  return ORION_GRAPH_ID
}
