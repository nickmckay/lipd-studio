# lipd-studio — Claude Project Guide

## What this is

A browser-based desktop app for opening, editing, and visualizing LiPD (Linked PaleoData) files.
Built with React + TypeScript + Vite. Planned packaging: Tauri (~15 MB) once features stabilize.

## Development commands

```bash
npm run dev      # dev server (localhost:5173)
npm run build    # type-check + production build
npm run lint     # ESLint
```

## Architecture

### Layout

2×2 panel grid. Each cell has its own mini tab bar. All four panels are always mounted.

| Position | Tabs |
|---|---|
| Top-left | Metadata + Changelog / Issues / JSON |
| Top-right | Structure |
| Bottom-left | Map / Plot |
| Bottom-right | Column / Data |

The global `selectedTSid` state flows from App down to all panels, keeping column selection in sync across Plot and Column panels.

### Key state in App.tsx

| State | Purpose |
|---|---|
| `lipd` | The loaded `LipdFile` (metadata + filename + raw csvData) |
| `selectedTSid` | Currently selected column TSid |
| `tlTab / blTab / brTab` | Active tab per panel (top-left, bottom-left, bottom-right) |
| `dataTablePath` | Path string passed to DataEditor to pre-select a table |
| `savedHashRef` | Hash of metadata content (excluding changelog/version) for dirty detection |

### Dirty detection and changelog

`contentHash()` serialises metadata excluding `changelog` and `datasetVersion`. On save, if the hash has changed since load/last-save, `appendChangelog()` is called automatically before serialising. Manual changelog edits do not trigger an extra auto-entry.

---

## File map

### `src/types/lipd.ts`
All TypeScript interfaces. `LipdColumn.values` is runtime-only (not stored in JSON on disk). `LipdColumn` and `LipdMetadata` use `[key: string]: unknown` for extensibility. `_synthetic` and `_origNumber` are also runtime-only flags stripped before serialization.

### `src/lib/lipd.ts`
Core I/O and helpers.

- `parseLipd(file)` — reads ZIP, finds `.jsonld`, injects CSV values into `col.values`
- `serializeLipd(lipd)` — rebuilds ZIP with BagIt manifests; measurement CSVs are regenerated from `col.values`; ensemble/summary/distribution CSVs are kept from original `lipd.csvData`
- `injectValues(table, csvData)` — expands array-numbered columns (e.g. ensemble tables where `col.number = [2,3,...,1001]`) into synthetic individual columns, synthesizes extra columns for CSV columns beyond what JSON defines, falls back to array index if `col.number` is missing
- `stripValues(metadata)` — strips `col.values` and `_synthetic` columns, restores `_origNumber` → `col.number` for round-trip fidelity
- `reattachAllValues(source, target)` — re-attaches `col.values` after JSON clone (covers all table types: measurement, ensemble, summary, distribution)
- `resolveTableFromPath(metadata, path)` — resolves paths like `paleoData[0].model[0].ensembleTable[0]`
- `allSectionTables(section)` — generator over all table types in a section
- `getTables` — flat list of ALL table entries (measurement + model sub-tables) with path + label; used by DataEditor
- `getColumns` — flat list of measurementTable columns with path; used by ColumnList
- `updateCellValue / deleteTableRow / addTableRow` — immutable metadata updates; all use JSON clone + `reattachAllValues` pattern
- `getCleanMetadata(metadata)` — returns `stripValues(metadata)` for display in the JSON editor
- `applyJsonEdit(edited, original)` — re-attaches values from original after a JSON edit
- `bumpVersion / appendChangelog` — semantic version bump (patch), auto-called on save

### `src/lib/validate.ts`
Returns `Issue[]` from `validateLipd(metadata)`. Severity: `'error'` or `'warning'`.

### `src/lib/vocabulary.ts`
Arrays of valid strings for LiPD controlled vocabularies: `ARCHIVE_TYPES`, `INTERP_VARIABLES`, `SEASONALITY`, `PROXY_TYPES`, `PROXY_GENERAL`, `UNITS`, `VARIABLE_NAMES`.

### `src/components/StructureView.tsx`
SVG-based interactive vertical tree (depth → Y, siblings → X, leaf-centering layout). Node types: `root | paleo | chron | model | measurement | ensemble | summary | distribution | col`. Colors: root=blue, paleo=lime-green, chron=coral-red, model=grey-purple, measurement=violet, ensemble=gold, summary=cyan, distribution=muted green, col=grey-blue. Node IDs match `getTables()` path strings — "Data" buttons pass them directly to DataEditor. Ensemble table nodes default to collapsed (hundreds of column children). Distribution table nodes also default to collapsed.

### `src/components/DataEditor.tsx`
HTML `<table>` with click-to-edit cells. Covers ALL table types (measurement, ensemble, summary, distribution) via `getTables`. Uses `useTransition` to show a loading spinner when switching to large tables (ensemble tables with 1000+ columns). Ensemble member columns are synthesized at parse time and displayed with `#N variableName` headers (via `duplicateNames` detection).

### `src/components/ColumnEditor.tsx`
Edits column metadata. Sections: Column (variableName, units, description, proxy, proxyGeneral), one section per interpretation (variable, variableDetail, seasonality, direction, scope, basis + extra fields), Add interpretation button, Extra fields section, Add field section with datalist suggestions.

### `src/components/ChangelogPanel.tsx`
Collapsible timeline of changelog entries. Each entry header (version + date + author) toggles expanded detail. The expanded section renders `changes` objects (lipdR format: `{ "type": [["desc"]] }`) as grouped bullet lists, `notes` as plain text, and other fields with a label. Handles `curator`/`timestamp` fields from lipdR-generated entries.

### `src/components/JsonEditor.tsx`
Raw JSON editor for `metadata.jsonld` (values stripped via `getCleanMetadata`). Apply button parses and re-attaches values via `applyJsonEdit`. Reset reverts to current state. Shown on the "JSON" tab of the top-left panel.

### `src/components/TimeSeriesPlot.tsx`
Imperative Plotly via `useEffect` + dynamic `import('plotly.js-dist-min')`. **Do not use react-plotly.js** — crashes at module-init with Plotly v3.

### `src/components/ColumnList.tsx`
Accepts optional `className` prop. `className="panel-sidebar"` overrides flex:1 with a fixed 190 px width for use inside `.panel-split`.

### `src/components/SiteMap.tsx`
React-Leaflet. Marker icon fix already applied — do not remove.

---

## CSS conventions

All styles live in `src/App.css`. Component-specific classes are prefixed with the component name.

Key layout classes:
- `.workspace-grid` — CSS Grid 35fr / 65fr columns, 1fr / 1fr rows
- `.panel-cell` — one grid cell (flex column)
- `.panel-tabbar` — mini tab row at top of cell
- `.panel-body` — content area (flex: 1, overflow: hidden)
- `.panel-split` — horizontal split: sidebar + main
- `.panel.panel-sidebar` — 190 px fixed-width column list
- `.panel-split-main` — flex: 1 content area
- `.metadata-tab` — scrollable stacking wrapper for MetadataPanel + ChangelogPanel

---

## LiPD file format notes

An `.lpd` file is a ZIP archive following the BagIt spec:

```
myfile.lpd
└── bag/
    ├── bagit.txt
    ├── bag-info.txt
    ├── manifest-md5.txt        ← MD5s of data/ files
    ├── tagmanifest-md5.txt     ← MD5s of bag-info/bagit/manifest
    └── data/
        ├── metadata.jsonld     ← all metadata
        └── *.csv               ← one per table
```

CSV files have **no header row**. Column order is `col.number` (1-based). Missing values are `NaN`.

`col.values` is loaded into memory on parse and stripped before writing `metadata.jsonld`. Measurement table CSVs are rebuilt from `col.values` on serialize; ensemble/distribution CSVs are preserved verbatim from `lipd.csvData`.

**Ensemble table format**: JSON defines 1-2 column objects (e.g. depth + one ageEnsemble), but ageEnsemble's `number` field is an array `[2, 3, ..., 1001]` encoding all member column indices. `injectValues` expands this into individual synthetic column objects at parse time. `stripValues` restores the array form before writing.

---

## Known gotchas

- **Plotly v3 + react-plotly.js**: incompatible. Always use the imperative pattern in `useEffect`. See `TimeSeriesPlot.tsx`.
- **Ensemble `col.number` as array**: Real LiPD files store ensemble member indices as `number: [2, 3, ..., N]` on a single column object. `injectValues` expands these; `stripValues` restores them. Do not break this round-trip.
- **`reattachAllValues` pattern**: JSON clone strips all `col.values`. Every function that immutably updates metadata must call `reattachAllValues(original, clone)` before returning. Covers all table types.
- **Synthetic columns** (`_synthetic: true`): created at parse time for ensemble members beyond defined column objects. Stripped by `stripValues` before serialization. Never write these to disk.
- **`_origNumber`**: stored on the first expanded column to restore the array form of `col.number` during `stripValues`. Also stripped before serialization.
- **Leaflet marker icons** break with bundlers; fix already applied in `SiteMap.tsx`.

---

## What's implemented

- Open/save `.lpd` files (full BagIt-compliant round-trip)
- 2×2 panel layout: Metadata+Changelog / Issues / JSON, Structure, Map / Plot, Column / Data
- Interactive SVG hierarchy tree (StructureView) with collapse/expand and "Data" shortcut buttons
- Time series scatter plot (Plotly, auto-detects age/year axis)
- Site map (Leaflet/OpenStreetMap)
- Column metadata editor: standard fields + multiple interpretations + arbitrary extra fields
- Data table editor: all table types, click-to-edit cells, add/delete rows, loading spinner for large tables
- Ensemble table display: all 1000+ members shown as individual scrollable columns
- Validation panel (errors + warnings against LiPD schema + controlled vocabularies)
- Changelog timeline: collapsible entries with structured rendering of lipdR `changes` objects
- Raw JSON editor (metadata.jsonld view/edit with Apply/Reset)

## Planned / not yet done

- Tauri packaging for Mac/PC standalone distribution
- Multi-file batch open
- Export to other formats (CSV, JSON-LD)
- Age model visualization
- Drag-to-reorder columns
