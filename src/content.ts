
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ready: true })
    return true
  }

  if (message.type === 'EXTRACT_PAGE') {

    const pageData = {
      title: document.title,
      url: window.location.href,
      text: document.body.innerText
    }


    chrome.runtime.sendMessage({
      type: 'PROCESS_EXTRACTION',
      pageData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Content] Error sending to background:', chrome.runtime.lastError)
        sendResponse({ success: false, error: chrome.runtime.lastError.message })
        return
      }

      sendResponse(response)
    })

    return true
  }
})
