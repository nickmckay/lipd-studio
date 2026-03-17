import Plot from 'react-plotly.js'
import type { LipdMetadata } from '../types/lipd'
import { getColumns } from '../lib/lipd'
import { useMemo, useRef, useState, useEffect } from 'react'

interface Props {
  metadata: LipdMetadata
  selectedTSid: string | null
}

export function TimeSeriesPlot({ metadata, selectedTSid }: Props) {
  const columns = useMemo(() => getColumns(metadata), [metadata])
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 600, height: 400 })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setSize({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const { ageCol, dataCol } = useMemo(() => {
    if (!selectedTSid) return { ageCol: null, dataCol: null }

    const entry = columns.find(c => c.col.TSid === selectedTSid)
    if (!entry) return { ageCol: null, dataCol: null }

    const tableCols = columns.filter(c => c.path === entry.path)
    const dataCol = entry.col

    const ageCol =
      tableCols.find(c =>
        ['year', 'age', 'age-yrad', 'yearad'].includes(c.col.variableName.toLowerCase()) &&
        c.col.TSid !== selectedTSid
      )?.col ??
      tableCols.find(c => c.col.TSid !== selectedTSid)?.col ??
      null

    return { ageCol, dataCol }
  }, [selectedTSid, columns])

  if (!dataCol || !ageCol) {
    return (
      <div className="panel plot-panel empty">
        <p>Select a variable from the list to plot it.</p>
      </div>
    )
  }

  const xVals = ageCol.values
  const yVals = dataCol.values

  if (!xVals || !yVals || xVals.length === 0) {
    return (
      <div className="panel plot-panel empty">
        <p>No data values found for this variable.</p>
      </div>
    )
  }

  const xLabel = `${ageCol.variableName}${ageCol.units ? ` (${ageCol.units})` : ''}`
  const yLabel = `${dataCol.variableName}${dataCol.units ? ` (${dataCol.units})` : ''}`

  return (
    <div ref={containerRef} className="panel plot-panel">
      <Plot
        data={[{
          x: xVals as number[],
          y: yVals as number[],
          type: 'scatter',
          mode: 'lines+markers',
          marker: { size: 4, color: '#4a90d9' },
          line: { color: '#4a90d9', width: 1.5 },
          name: dataCol.variableName,
          connectgaps: false,
        }]}
        layout={{
          width: size.width,
          height: size.height,
          margin: { l: 70, r: 20, t: 30, b: 60 },
          xaxis: { title: { text: xLabel }, autorange: true, gridcolor: '#2d2d4e', color: '#e0e0f0' },
          yaxis: { title: { text: yLabel }, gridcolor: '#2d2d4e', color: '#e0e0f0' },
          paper_bgcolor: 'transparent',
          plot_bgcolor: '#1a1a2e',
          font: { color: '#e0e0f0', size: 12 },
        }}
        config={{ displayModeBar: true, displaylogo: false, responsive: false }}
      />
    </div>
  )
}
