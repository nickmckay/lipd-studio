import type { LipdMetadata } from '../types/lipd'
import { getColumns } from '../lib/lipd'

interface Props {
  metadata: LipdMetadata
  selectedTSid: string | null
  onSelect: (tsid: string) => void
}

export function ColumnList({ metadata, selectedTSid, onSelect }: Props) {
  const columns = getColumns(metadata)

  return (
    <div className="panel column-list">
      <h2>Variables</h2>
      <ul>
        {columns.map(({ path, col }) => (
          <li
            key={col.TSid}
            className={col.TSid === selectedTSid ? 'selected' : ''}
            onClick={() => onSelect(col.TSid)}
          >
            <span className="var-name">{col.variableName}</span>
            {col.units && <span className="var-units">{col.units}</span>}
            <span className="var-path">{path}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
