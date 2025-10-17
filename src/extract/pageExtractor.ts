export interface PageData {
  url: string
  title: string
  content: string
  favicon?: string
  metadata?: Record<string, string>
}

export async function extractPageContent(): Promise<PageData> {
  const title = document.title
  const url = window.location.href

  const content = extractMainContent()

  const favicon = extractFavicon()

  return {
    url,
    title,
    content,
    favicon,
  }
}

function extractMainContent(): string {
  const article = document.querySelector('article')
  if (article) {
    return article.innerText.trim()
  }

  const main = document.querySelector('main')
  if (main) {
    return main.innerText.trim()
  }

  return document.body.innerText.trim()
}

function extractFavicon(): string | undefined {
  const iconLink = document.querySelector<HTMLLinkElement>(
    'link[rel~="icon"]'
  )
  return iconLink?.href
}
