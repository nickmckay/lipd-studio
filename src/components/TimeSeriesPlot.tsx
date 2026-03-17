import Plot from 'react-plotly.js'
import type { LipdMetadata } from '../types/lipd'
import { getColumns } from '../lib/lipd'
import { useMemo } from 'react'

interface Props {
  metadata: LipdMetadata
  selectedTSid: string | null
}

export function TimeSeriesPlot({ metadata, selectedTSid }: Props) {
  const columns = getColumns(metadata)

  // Find the age/year column in the same table as the selected column
  const { ageCol, dataCol } = useMemo(() => {
    if (!selectedTSid) return { ageCol: null, dataCol: null }

    const entry = columns.find(c => c.col.TSid === selectedTSid)
    if (!entry) return { ageCol: null, dataCol: null }

    // Find all columns in the same table
    const tableCols = columns.filter(c => c.path === entry.path)
    const dataCol = entry.col

    // Prefer year/age column in same table
    const ageCol = tableCols.find(c =>
      ['year', 'age', 'age-yrad', 'yearad'].includes(c.col.variableName.toLowerCase())
        && c.col.TSid !== selectedTSid
    )?.col ?? tableCols.find(c => c.col.TSid !== selectedTSid)?.col ?? null

    return { ageCol, dataCol }
  }, [selectedTSid, columns])

  if (!dataCol || !ageCol) {
    return (
      <div className="panel plot-panel empty">
        <p>Select a variable from the list to plot it.</p>
      </div>
    )
  }

  const x = ageCol.values as number[]
  const y = dataCol.values as number[]

  const xLabel = `${ageCol.variableName}${ageCol.units ? ` (${ageCol.units})` : ''}`
  const yLabel = `${dataCol.variableName}${dataCol.units ? ` (${dataCol.units})` : ''}`

  return (
    <div className="panel plot-panel">
      <Plot
        data={[{
          x,
          y,
          type: 'scatter',
          mode: 'lines+markers',
          marker: { size: 4, color: '#4a90d9' },
          line: { color: '#4a90d9', width: 1.5 },
          name: dataCol.variableName,
        }]}
        layout={{
          autosize: true,
          margin: { l: 60, r: 20, t: 30, b: 60 },
          xaxis: { title: xLabel, autorange: true },
          yaxis: { title: yLabel },
          paper_bgcolor: 'transparent',
          plot_bgcolor: '#1a1a2e',
          font: { color: '#e0e0e0' },
          xaxis_gridcolor: '#333',
          yaxis_gridcolor: '#333',
        } as object}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
        config={{ responsive: true, displayModeBar: true, displaylogo: false }}
      />
    </div>
  )
}
