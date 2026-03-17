import type { LipdMetadata, LipdColumn } from '../types/lipd'
import { VARIABLE_NAMES, UNITS, PROXY_TYPES, PROXY_GENERAL, INTERP_VARIABLES, SEASONALITY } from '../lib/vocabulary'

interface Props {
  metadata: LipdMetadata
  selectedTSid: string | null
  onChange: (updated: LipdMetadata) => void
}

// Helper: deep clone and update a column by TSid
function updateColumn(metadata: LipdMetadata, tsid: string, updater: (col: LipdColumn) => LipdColumn): LipdMetadata {
  const clone = JSON.parse(JSON.stringify(metadata)) as LipdMetadata
  // Preserve values (not in JSON)
  const sections = [...(metadata.paleoData ?? []), ...(metadata.chronData ?? [])]
  const cloneSections = [...(clone.paleoData ?? []), ...(clone.chronData ?? [])]
  sections.forEach((sec, si) => {
    ;(sec.measurementTable ?? []).forEach((tbl, ti) => {
      tbl.columns.forEach((col, ci) => {
        if (col.TSid === tsid) {
          cloneSections[si].measurementTable![ti].columns[ci] = updater(JSON.parse(JSON.stringify(col)))
          // Re-attach values since they were stripped by JSON clone of original
          cloneSections[si].measurementTable![ti].columns[ci].values = col.values
        }
      })
    })
  })
  return clone
}

function findColumn(metadata: LipdMetadata, tsid: string): LipdColumn | null {
  const sections = [...(metadata.paleoData ?? []), ...(metadata.chronData ?? [])]
  for (const sec of sections) {
    for (const tbl of sec.measurementTable ?? []) {
      for (const col of tbl.columns) {
        if (col.TSid === tsid) return col
      }
    }
  }
  return null
}

export function ColumnEditor({ metadata, selectedTSid, onChange }: Props) {
  if (!selectedTSid) {
    return <div className="panel column-editor empty"><p>Select a variable to edit its metadata.</p></div>
  }

  const col = findColumn(metadata, selectedTSid)
  if (!col) return <div className="panel column-editor empty"><p>Column not found.</p></div>

  const set = (key: string, value: unknown) => {
    onChange(updateColumn(metadata, selectedTSid, c => ({ ...c, [key]: value })))
  }

  const interp = col.interpretation?.[0] ?? {}
  const setInterp = (key: string, value: unknown) => {
    onChange(updateColumn(metadata, selectedTSid, c => {
      const interps = c.interpretation ? [...c.interpretation] : [{}]
      interps[0] = { ...interps[0], [key]: value }
      return { ...c, interpretation: interps }
    }))
  }

  return (
    <div className="panel column-editor">
      <h2>{col.variableName}</h2>
      <p className="tsid-label">TSid: {col.TSid}</p>

      <section>
        <h3>Column</h3>

        <div className="field">
          <label>Variable name</label>
          <input list="varname-list" value={col.variableName ?? ''} onChange={e => set('variableName', e.target.value)} />
          <datalist id="varname-list">{VARIABLE_NAMES.map(v => <option key={v} value={v} />)}</datalist>
        </div>

        <div className="field">
          <label>Units</label>
          <input list="units-list" value={(col.units ?? '') as string} onChange={e => set('units', e.target.value)} />
          <datalist id="units-list">{UNITS.map(v => <option key={v} value={v} />)}</datalist>
        </div>

        <div className="field">
          <label>Description</label>
          <input value={(col.description ?? '') as string} onChange={e => set('description', e.target.value)} />
        </div>

        <div className="field">
          <label>Proxy</label>
          <input list="proxy-list" value={(col.proxy ?? '') as string} onChange={e => set('proxy', e.target.value)} />
          <datalist id="proxy-list">{PROXY_TYPES.map(v => <option key={v} value={v} />)}</datalist>
        </div>

        <div className="field">
          <label>Proxy general</label>
          <select value={(col.proxyGeneral ?? '') as string} onChange={e => set('proxyGeneral', e.target.value)}>
            <option value="">— none —</option>
            {PROXY_GENERAL.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </section>

      <section>
        <h3>Interpretation</h3>

        <div className="field">
          <label>Variable</label>
          <select value={(interp.variable ?? '') as string} onChange={e => setInterp('variable', e.target.value)}>
            <option value="">— none —</option>
            {INTERP_VARIABLES.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Variable detail</label>
          <input value={(interp.variableDetail ?? '') as string} onChange={e => setInterp('variableDetail', e.target.value)} />
        </div>

        <div className="field">
          <label>Seasonality</label>
          <select value={(interp.seasonality ?? '') as string} onChange={e => setInterp('seasonality', e.target.value)}>
            <option value="">— none —</option>
            {SEASONALITY.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Direction</label>
          <select value={(interp.direction ?? '') as string} onChange={e => setInterp('direction', e.target.value)}>
            <option value="">— none —</option>
            <option value="positive">positive</option>
            <option value="negative">negative</option>
          </select>
        </div>

        <div className="field">
          <label>Scope</label>
          <select value={(interp.scope ?? '') as string} onChange={e => setInterp('scope', e.target.value)}>
            <option value="">— none —</option>
            <option value="climate">climate</option>
            <option value="isotope">isotope</option>
          </select>
        </div>

        <div className="field">
          <label>Basis</label>
          <input value={(interp.basis ?? '') as string} onChange={e => setInterp('basis', e.target.value)} />
        </div>
      </section>
    </div>
  )
}
