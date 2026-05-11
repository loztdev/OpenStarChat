/**
 * Cross-platform file download that works in both browsers and Capacitor
 * WebView (Android). The standard createObjectURL + click approach fails
 * silently in Capacitor, so we try the Web Share API first (which
 * Android supports natively) then fall back to the <a> click approach.
 */
export async function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const blob = new Blob([content], { type: mimeType })

  // Attempt the Web Share API (works great on Android / Capacitor)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], filename, { type: mimeType })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        })
        return
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      // Share failed or was cancelled — fall through to <a> approach
    }
  }

  // Standard browser download via <a> tag
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
