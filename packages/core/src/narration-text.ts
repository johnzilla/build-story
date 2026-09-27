/** Split without dropping text. Limits count UTF-16 code units conservatively;
 * surrogate pairs stay intact. Prefer sentences, then whitespace, then a cut. */
export function splitNarration(text: string, maxCharacters: number): string[] {
  if (!Number.isSafeInteger(maxCharacters) || maxCharacters < 2) {
    throw new Error('Narration chunk limit must be an integer of at least 2')
  }
  const chunks: string[] = []
  let offset = 0
  while (offset < text.length) {
    const remaining = text.slice(offset)
    if (remaining.length <= maxCharacters) {
      chunks.push(remaining)
      break
    }
    const window = remaining.slice(0, maxCharacters)
    let end = 0
    for (const match of window.matchAll(/[.!?。！？](?:\s+|$)|\n+/gu)) {
      end = match.index + match[0].length
    }
    if (!end) {
      for (const match of window.matchAll(/\s+/gu)) end = match.index + match[0].length
    }
    if (!end) end = maxCharacters
    const last = remaining.charCodeAt(end - 1)
    if (last >= 0xd800 && last <= 0xdbff) end--
    chunks.push(remaining.slice(0, end))
    offset += end
  }
  return chunks
}
