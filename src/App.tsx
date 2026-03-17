import { useState, useCallback, useMemo } from 'react'
import { DropZone } from './components/DropZone'
import { MetadataPanel } from './components/MetadataPanel'
import { ColumnList } from './components/ColumnList'
import { ColumnEditor } from './components/ColumnEditor'
import { ValidationPanel } from './components/ValidationPanel'
import { TimeSeriesPlot } from './components/TimeSeriesPlot'
import { SiteMap } from './components/SiteMap'
import { serializeLipd } from './lib/lipd'
import { validateLipd } from './lib/validate'
import type { LipdFile, LipdMetadata } from './types/lipd'
import './App.css'

type Tab = 'plot' | 'map' | 'metadata' | 'column' | 'issues'

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

  const issues = useMemo(() => lipd ? validateLipd(lipd.metadata) : [], [lipd])
  const errorCount = issues.filter(i => i.severity === 'error').length
  const warningCount = issues.filter(i => i.severity === 'warning').length

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

  const tabs: Tab[] = ['plot', 'map', 'metadata', 'column', 'issues']

  function renderTabLabel(t: Tab) {
    if (t === 'issues') {
      const hasBadge = errorCount > 0 || warningCount > 0
      return (
        <>
          Issues
          {hasBadge && (
            <span className={`tab-issues-count ${errorCount > 0 ? 'has-errors' : 'has-warnings'}`}>
              {errorCount > 0 ? errorCount : warningCount}
            </span>
          )}
        </>
      )
    }
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  return (
    <div className="app workspace">
      <header className="toolbar">
        <span className="toolbar-title">
          {lipd.metadata.dataSetName ?? lipd.filename}
        </span>
        <nav className="tab-bar">
          {tabs.map(t => (
            <button
              key={t}
              className={tab === t ? 'active' : ''}
              onClick={() => setTab(t)}
            >
              {renderTabLabel(t)}
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
          {tab === 'column' && (
            <ColumnEditor
              metadata={lipd.metadata}
              selectedTSid={selectedTSid}
              onChange={handleMetadataChange}
            />
          )}
          {tab === 'issues' && (
            <ValidationPanel metadata={lipd.metadata} />
          )}
        </main>
      </div>
    </div>
  )
}
