console.log('Trace background service worker initialized')

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Trace extension installed')
  } else if (details.reason === 'update') {
    console.log('Trace extension updated')
  }
})

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error) => console.error('Error setting panel behavior:', error))
