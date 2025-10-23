export async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.id) {
    throw new Error('No active tab found');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      title: document.title,
      url: window.location.href,
      text: document.body.innerText
    })
  });

  if (!results[0]?.result) {
    throw new Error('Failed to extract content');
  }

  return results[0].result;
}

