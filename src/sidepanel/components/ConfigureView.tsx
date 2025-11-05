import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getSettings, saveSettings, detectChanges, DEFAULT_SETTINGS } from '@/services/settings'
import { recomputeAllTopicPositions } from '@/services/positions'
import type { AppSettings } from '@/services/settings'
import { Info } from 'lucide-react'

interface ConfigureViewProps {
  onFlash: (type: 'success' | 'error', message: string) => void
}

export function ConfigureView({ onFlash }: ConfigureViewProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings)
    setHasChanges(changed)
  }, [settings, originalSettings])

  const loadSettings = async () => {
    setIsLoading(true)
    const loaded = await getSettings()
    setSettings(loaded)
    setOriginalSettings(loaded)
    setIsLoading(false)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  const handleApply = async () => {
    setIsApplying(true)
    try {
      const changeType = detectChanges(originalSettings, settings)

      await saveSettings(settings)

      if (changeType === 'graph' || changeType === 'umap') {
        await recomputeAllTopicPositions()
      }

      setOriginalSettings(settings)
      setHasChanges(false)
      onFlash('success', 'Settings applied successfully')
    } catch (error) {
      console.error('[ConfigureView] Failed to apply settings:', error)
      const errorMsg = error instanceof Error ? error.message : 'Failed to apply settings'
      onFlash('error', errorMsg)
    } finally {
      setIsApplying(false)
    }
  }

  const updateGraphSetting = <K extends keyof AppSettings['graph']>(
    key: K,
    value: AppSettings['graph'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      graph: { ...prev.graph, [key]: value }
    }))
  }

  const updateSearchSetting = <K extends keyof AppSettings['search']>(
    key: K,
    value: AppSettings['search'][K]
  ) => {
    setSettings(prev => ({
      ...prev,
      search: { ...prev.search, [key]: value }
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Configure</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize graph behavior and search settings
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Graph</h3>
              <p className="text-sm text-muted-foreground">
                Control topic merging, connections, clustering, and visualization
              </p>
            </div>

            <Separator />

            <div className="space-y-6">
              <TooltipProvider>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="topicMergeThreshold">Topic Merge Threshold</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Similarity required to merge duplicate topics</p>
                        <p className="text-xs text-muted-foreground">Lower = more topics, Higher = more merging</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="topicMergeThreshold"
                      min={0.5}
                      max={1.0}
                      step={0.05}
                      value={[settings.graph.topicMergeThreshold]}
                      onValueChange={([value]) => updateGraphSetting('topicMergeThreshold', value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {settings.graph.topicMergeThreshold.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="edgeMinSimilarity">Edge Min Similarity</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum similarity to create edges</p>
                        <p className="text-xs text-muted-foreground">Lower = denser graph, Higher = sparse graph</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="edgeMinSimilarity"
                      min={0.3}
                      max={0.9}
                      step={0.05}
                      value={[settings.graph.edgeMinSimilarity]}
                      onValueChange={([value]) => updateGraphSetting('edgeMinSimilarity', value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {settings.graph.edgeMinSimilarity.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="maxEdgesPerNode">Max Edges Per Node</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Maximum connections per topic</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="maxEdgesPerNode"
                    type="number"
                    min={1}
                    max={20}
                    value={settings.graph.maxEdgesPerNode}
                    onChange={(e) => updateGraphSetting('maxEdgesPerNode', parseInt(e.target.value) || 5)}
                    className="w-24"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="clusterResolution">Cluster Resolution</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Cluster granularity</p>
                        <p className="text-xs text-muted-foreground">Lower = fewer large clusters, Higher = many small clusters</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="clusterResolution"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={[settings.graph.clusterResolution]}
                      onValueChange={([value]) => updateGraphSetting('clusterResolution', value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {settings.graph.clusterResolution.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="minClusterSize">Min Cluster Size</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum members to form a cluster</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="minClusterSize"
                    type="number"
                    min={2}
                    max={10}
                    value={settings.graph.minClusterSize}
                    onChange={(e) => updateGraphSetting('minClusterSize', parseInt(e.target.value) || 2)}
                    className="w-24"
                  />
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="umapMinDist">Node Spacing (Min Distance)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum distance between nodes in 3D space</p>
                        <p className="text-xs text-muted-foreground">Lower = tighter clusters, Higher = more spread</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="umapMinDist"
                      min={0.1}
                      max={1.0}
                      step={0.1}
                      value={[settings.graph.umapMinDist]}
                      onValueChange={([value]) => updateGraphSetting('umapMinDist', value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {settings.graph.umapMinDist.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="umapSpread">Node Spacing (Spread)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Effective scale of visualization space</p>
                        <p className="text-xs text-muted-foreground">Lower = compact, Higher = spacious</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="umapSpread"
                      min={0.5}
                      max={5.0}
                      step={0.5}
                      value={[settings.graph.umapSpread]}
                      onValueChange={([value]) => updateGraphSetting('umapSpread', value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {settings.graph.umapSpread.toFixed(1)}
                    </span>
                  </div>
                </div>
              </TooltipProvider>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium">Search</h3>
              <p className="text-sm text-muted-foreground">
                Control search result counts and similarity thresholds
              </p>
            </div>

            <Separator />

            <div className="space-y-6">
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="topicResultCount">Topic Results</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Number of topics in search results</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="topicResultCount"
                      type="number"
                      min={1}
                      max={20}
                      value={settings.search.topicResultCount}
                      onChange={(e) => updateSearchSetting('topicResultCount', parseInt(e.target.value) || 5)}
                      className="w-24"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="itemResultCount">Item Results</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Number of items in search results</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="itemResultCount"
                      type="number"
                      min={1}
                      max={50}
                      value={settings.search.itemResultCount}
                      onChange={(e) => updateSearchSetting('itemResultCount', parseInt(e.target.value) || 10)}
                      className="w-24"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="similarityThreshold">Similarity Threshold</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Minimum similarity for search matches</p>
                        <p className="text-xs text-muted-foreground">Lower = more results, Higher = more precise</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-4">
                    <Slider
                      id="similarityThreshold"
                      min={0.2}
                      max={0.8}
                      step={0.05}
                      value={[settings.search.similarityThreshold]}
                      onValueChange={([value]) => updateSearchSetting('similarityThreshold', value)}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-12 text-right">
                      {settings.search.similarityThreshold.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="maxEdgesInResults">Max Edges in Results</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Maximum edges to show in search visualization</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="maxEdgesInResults"
                    type="number"
                    min={5}
                    max={50}
                    value={settings.search.maxEdgesInResults}
                    onChange={(e) => updateSearchSetting('maxEdgesInResults', parseInt(e.target.value) || 20)}
                    className="w-24"
                  />
                </div>
              </TooltipProvider>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isApplying}
          >
            Reset
          </Button>
          <Button
            onClick={handleApply}
            disabled={!hasChanges || isApplying}
          >
            {isApplying ? 'Applying...' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  )
}
