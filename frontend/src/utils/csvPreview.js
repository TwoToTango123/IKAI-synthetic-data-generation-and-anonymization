export const parseCsvPreview = (text, maxRows = 5) => {
  const normalized = (text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()

  if (!normalized) {
    return { headers: [], rows: [] }
  }

  const parsedRows = []
  let currentRow = []
  let currentCell = ''
  let inQuotes = false

  const pushCell = () => {
    currentRow.push(currentCell)
    currentCell = ''
  }

  const pushRow = () => {
    if (currentRow.length > 0) {
      parsedRows.push(currentRow)
    }
    currentRow = []
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index]
    const nextCharacter = normalized[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        currentCell += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      pushCell()
      continue
    }

    if (character === '\n' && !inQuotes) {
      pushCell()
      pushRow()
      continue
    }

    currentCell += character
  }

  pushCell()
  pushRow()

  const headers = parsedRows[0] || []
  const rows = parsedRows.slice(1, maxRows + 1).map((row) => {
    if (headers.length === 0) {
      return row
    }

    if (row.length >= headers.length) {
      return row.slice(0, headers.length)
    }

    return [...row, ...Array.from({ length: headers.length - row.length }, () => '')]
  })

  return { headers, rows }
}