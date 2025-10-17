console.log('Trace content script loaded on:', window.location.href)

const isYouTube = window.location.hostname.includes('youtube.com')

if (isYouTube) {
  console.log('YouTube page detected')
}

function observePageChanges() {
  const observer = new MutationObserver(() => {
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  return observer
}

let pageObserver: MutationObserver | null = null

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    pageObserver = observePageChanges()
  })
} else {
  pageObserver = observePageChanges()
}
