export interface YouTubeData {
  videoId: string
  title: string
  url: string
  thumbnail?: string
  duration?: number
}

export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?]+)/,
    /youtu\.be\/([^?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

export async function extractYouTubeData(): Promise<YouTubeData | null> {
  const url = window.location.href
  const videoId = extractYouTubeVideoId(url)

  if (!videoId) {
    return null
  }

  const title = document.title.replace(' - YouTube', '')

  const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  return {
    videoId,
    title,
    url,
    thumbnail,
  }
}
