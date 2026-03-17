import { useState, useCallback } from 'react'
import { DropZone } from './components/DropZone'
import { MetadataPanel } from './components/MetadataPanel'
import { ColumnList } from './components/ColumnList'
import { TimeSeriesPlot } from './components/TimeSeriesPlot'
import { SiteMap } from './components/SiteMap'
import { serializeLipd } from './lib/lipd'
import type { LipdFile, LipdMetadata } from './types/lipd'
import './App.css'

type Tab = 'plot' | 'map' | 'metadata'

export default function App() {
  const [lipd, setLipd] = useState<LipdFile | null>(null)
  const [selectedTSid, setSelectedTSid] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('plot')
  const [saving, setSaving] = useState(false)

  const handleMetadataChange = useCallback((updated: LipdMetadata) => {
    setLipd(prev => prev ? { ...prev, metadata: updated } : null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!lipd) return
    setSaving(true)
    try {
      const blob = await serializeLipd(lipd)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = lipd.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setSaving(false)
    }
  }, [lipd])

  if (!lipd) {
    return (
      <div className="app landing">
        <div className="landing-header">
          <h1>LiPD Studio</h1>
          <p>Open, edit, and visualize paleoclimate data files</p>
        </div>
        <DropZone onLoad={f => { setLipd(f); setSelectedTSid(null) }} />
      </div>
    )
  }

  return (
    <div className="app workspace">
      <header className="toolbar">
        <span className="toolbar-title">
          {lipd.metadata.dataSetName ?? lipd.filename}
        </span>
        <nav className="tab-bar">
          {(['plot', 'map', 'metadata'] as Tab[]).map(t => (
            <button
              key={t}
              className={tab === t ? 'active' : ''}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <div className="toolbar-actions">
          <button onClick={handleSave} disabled={saving} className="btn-save">
            {saving ? 'Saving…' : 'Save .lpd'}
          </button>
          <button onClick={() => { setLipd(null); setSelectedTSid(null) }} className="btn-close">
            Close
          </button>
        </div>
      </header>

      <div className="workspace-body">
        <aside className="sidebar">
          <ColumnList
            metadata={lipd.metadata}
            selectedTSid={selectedTSid}
            onSelect={setSelectedTSid}
          />
        </aside>

        <main className="main-content">
          {tab === 'plot' && (
            <TimeSeriesPlot metadata={lipd.metadata} selectedTSid={selectedTSid} />
          )}
          {tab === 'map' && (
            <SiteMap metadata={lipd.metadata} />
          )}
          {tab === 'metadata' && (
            <MetadataPanel metadata={lipd.metadata} onChange={handleMetadataChange} />
          )}
        </main>
      </div>
    </div>
  )
}
