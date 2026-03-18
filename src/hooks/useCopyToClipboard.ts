import { useState, useCallback } from 'react';

/**
 * Shared clipboard hook with error handling and visual feedback.
 * Returns { copiedId, copyToClipboard } where copiedId is the currently-copied
 * string (auto-clears after 2s) for UI feedback.
 */
export function useCopyToClipboard() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for non-secure contexts or permission denial
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  return { copiedId, copyToClipboard };
}
