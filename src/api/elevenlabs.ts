/**
 * ElevenLabs TTS from the browser. Their API may block some origins via CORS;
 * if fetch fails, callers should fall back to speechSynthesis.
 */
export async function elevenLabsSpeak(opts: {
  apiKey: string
  voiceId: string
  text: string
}): Promise<void> {
  const { apiKey, voiceId, text } = opts
  const trimmed = text.trim()
  if (!trimmed) return

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: trimmed.slice(0, 2500),
      model_id: 'eleven_turbo_v2_5',
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`ElevenLabs ${res.status}: ${errText.slice(0, 200)}`)
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Audio playback failed'))
    }
    void audio.play().catch(reject)
  })
}
