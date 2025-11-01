import { useState, useEffect } from 'react';

export function useAutoExtract() {
  const [autoExtract, setAutoExtractState] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['autoExtract'], (result) => {
      setAutoExtractState(result.autoExtract || false);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.autoExtract) {
        setAutoExtractState(changes.autoExtract.newValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const setAutoExtract = (checked: boolean) => {
    setAutoExtractState(checked);
    chrome.storage.local.set({ autoExtract: checked });
  };

  return [autoExtract, setAutoExtract] as const;
}
