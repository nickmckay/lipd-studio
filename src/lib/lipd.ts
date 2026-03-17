import JSZip from 'jszip'
import SparkMD5 from 'spark-md5'
import type { LipdFile, LipdMetadata, LipdColumn, LipdTable } from '../types/lipd'

// ---- Parse ----------------------------------------------------------------

export async function parseLipd(file: File): Promise<LipdFile> {
  const zip = await JSZip.loadAsync(file)

  // Find metadata.jsonld (may be at different depths)
  const jsonldEntry = Object.values(zip.files).find(
    f => !f.dir && f.name.endsWith('.jsonld')
  )
  if (!jsonldEntry) throw new Error('No .jsonld file found in archive')

  const metadataText = await jsonldEntry.async('text')
  const metadata: LipdMetadata = JSON.parse(metadataText)

  // Collect all CSV files
  const csvData: Record<string, string> = {}
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!entry.dir && name.endsWith('.csv')) {
      const basename = name.split('/').pop()!
      csvData[basename] = await entry.async('text')
    }
  }

  // Inject values into column objects
  loadCsvValues(metadata, csvData)

  return { metadata, filename: file.name, csvData }
}

function loadCsvValues(metadata: LipdMetadata, csvData: Record<string, string>) {
  const sections = [
    ...(metadata.paleoData ?? []),
    ...(metadata.chronData ?? []),
  ]
  for (const section of sections) {
    for (const table of section.measurementTable ?? []) {
      injectValues(table, csvData)
    }
    for (const model of section.model ?? []) {
      for (const t of [...(model.summaryTable ?? []), ...(model.ensembleTable ?? [])]) {
        injectValues(t, csvData)
      }
    }
  }
}

function injectValues(table: LipdTable, csvData: Record<string, string>) {
  const filename = table.filename ? table.filename.split('/').pop()! : undefined
  if (!filename || !csvData[filename]) return

  const rows = csvData[filename]
    .trim()
    .split('\n')
    .map(line => line.split(',').map(v => v.trim()))

  for (const col of table.columns) {
    const idx = col.number - 1
    col.values = rows.map(row => {
      const v = row[idx]
      if (v === undefined || v === '' || v?.toLowerCase() === 'nan') return null
      const n = Number(v)
      return isNaN(n) ? v : n
    })
  }
}

// ---- Serialize ------------------------------------------------------------

export async function serializeLipd(lipd: LipdFile): Promise<Blob> {
  const zip = new JSZip()
  const bag = zip.folder('bag')!
  const data = bag.folder('data')!

  // Strip values from columns before serializing metadata
  const metaClean = stripValues(lipd.metadata)
  const metaText = JSON.stringify(metaClean, null, 2)
  data.file('metadata.jsonld', metaText)

  // Rebuild CSVs from column values
  const regeneratedCsvs = buildCsvFiles(lipd.metadata)
  for (const [fname, content] of Object.entries(regeneratedCsvs)) {
    data.file(fname, content)
  }
  // Also include any CSVs not regenerated (e.g. ensemble tables)
  for (const [fname, content] of Object.entries(lipd.csvData)) {
    if (!regeneratedCsvs[fname]) {
      data.file(fname, content)
    }
  }

  // BagIt tag files
  bag.file('bagit.txt', 'BagIt-Version: 0.97\nTag-File-Character-Encoding: UTF-8\n')
  bag.file('bag-info.txt', `Bag-Software-Agent: lipd-studio\nBagging-Date: ${new Date().toISOString().slice(0, 10)}\nName: LiPD Project\nReference: www.lipd.net\n`)

  // Compute manifest-md5.txt
  const dataFiles: Record<string, Uint8Array> = {}
  for (const [name, file] of Object.entries(data.files)) {
    if (!file.dir) {
      dataFiles[name] = await file.async('uint8array')
    }
  }
  const manifestLines: string[] = []
  for (const [name, bytes] of Object.entries(dataFiles).sort()) {
    const md5 = SparkMD5.ArrayBuffer.hash(bytes.buffer as ArrayBuffer)
    const shortName = name.replace('bag/data/', 'data/')
    manifestLines.push(`${md5}  ${shortName}`)
  }
  bag.file('manifest-md5.txt', manifestLines.join('\n') + '\n')

  // Compute tagmanifest-md5.txt
  const tagFiles = ['bag-info.txt', 'bagit.txt', 'manifest-md5.txt']
  const tagLines: string[] = []
  for (const tf of tagFiles) {
    const entry = bag.file(tf)
    if (entry) {
      const bytes = await entry.async('uint8array')
      const md5 = SparkMD5.ArrayBuffer.hash(bytes.buffer as ArrayBuffer)
      tagLines.push(`${md5}  ${tf}`)
    }
  }
  bag.file('tagmanifest-md5.txt', tagLines.join('\n') + '\n')

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

function stripValues(metadata: LipdMetadata): LipdMetadata {
  const clone = JSON.parse(JSON.stringify(metadata)) as LipdMetadata
  const sections = [...(clone.paleoData ?? []), ...(clone.chronData ?? [])]
  for (const section of sections) {
    for (const table of section.measurementTable ?? []) {
      for (const col of table.columns) delete col.values
    }
  }
  return clone
}

function buildCsvFiles(metadata: LipdMetadata): Record<string, string> {
  const out: Record<string, string> = {}
  const sections = [...(metadata.paleoData ?? []), ...(metadata.chronData ?? [])]
  for (const section of sections) {
    for (const table of section.measurementTable ?? []) {
      if (!table.filename || !table.columns.length) continue
      const fname = table.filename.split('/').pop()!
      const cols = [...table.columns].sort((a, b) => a.number - b.number)
      const rowCount = Math.max(...cols.map(c => c.values?.length ?? 0))
      const lines: string[] = []
      for (let i = 0; i < rowCount; i++) {
        lines.push(cols.map(c => {
          const v = c.values?.[i]
          return v === null || v === undefined ? 'NaN' : String(v)
        }).join(','))
      }
      out[fname] = lines.join('\n') + '\n'
    }
  }
  return out
}

// ---- Helpers --------------------------------------------------------------

export function getColumns(metadata: LipdMetadata): Array<{ path: string; col: LipdColumn }> {
  const result: Array<{ path: string; col: LipdColumn }> = []
  const sections = [
    { key: 'paleoData', data: metadata.paleoData ?? [] },
    { key: 'chronData', data: metadata.chronData ?? [] },
  ]
  for (const { key, data } of sections) {
    data.forEach((section, pi) => {
      ;(section.measurementTable ?? []).forEach((table, ti) => {
        table.columns.forEach(col => {
          result.push({ path: `${key}[${pi}].measurementTable[${ti}]`, col })
        })
      })
    })
  }
  return result
}

export function getSiteName(metadata: LipdMetadata): string {
  return (
    metadata.geo?.properties?.siteName ??
    metadata.geo?.siteName ??
    metadata.dataSetName ??
    'Unknown site'
  )
}

export function getCoordinates(metadata: LipdMetadata): [number, number] | null {
  const geo = metadata.geo
  if (!geo) return null
  const coords = geo.geometry?.coordinates
  if (coords) return [coords[1], coords[0]] // [lat, lng]
  if (geo.latitude != null && geo.longitude != null) return [geo.latitude, geo.longitude]
  return null
}
