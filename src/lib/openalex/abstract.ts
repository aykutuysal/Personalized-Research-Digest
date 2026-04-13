// src/lib/openalex/abstract.ts
export function reconstructAbstract(
  invertedIndex: Record<string, number[]> | null | undefined,
): string | null {
  if (!invertedIndex) return null
  const positions: Array<[number, string]> = []
  for (const [token, idxList] of Object.entries(invertedIndex)) {
    for (const pos of idxList) positions.push([pos, token])
  }
  positions.sort((a, b) => a[0] - b[0])
  return positions.map(([, token]) => token).join(' ')
}
