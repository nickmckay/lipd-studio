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

| Position | Primary tab | Secondary tab |
|---|---|---|
| Top-left | Metadata + Changelog | Issues |
| Top-right | Structure | — |
| Bottom-left | Map | Plot |
| Bottom-right | Column | Data |

The global `selectedTSid` state flows from App down to all panels, keeping the column selection in sync across the Plot and Column panels.

### Key state in App.tsx

| State | Purpose |
|---|---|
| `lipd` | The loaded `LipdFile` (metadata + filename + raw csvData) |
| `selectedTSid` | Currently selected column TSid |
| `tlTab / blTab / brTab` | Active tab per panel (top-left, bottom-left, bottom-right) |
| `dataTablePath` | Path string passed to DataEditor to pre-select a table |
| `savedHashRef` | Hash of metadata content (excluding changelog/version) used to detect real edits |

### Dirty detection and changelog

`contentHash()` serialises metadata excluding `changelog` and `datasetVersion`. On save, if the hash has changed since load/last-save, `appendChangelog()` is called automatically before serialising. This means:
- Manual changelog edits (which only touch `changelog`) do **not** trigger an extra auto-entry
- Multiple saves without edits produce only one entry per editing session

---

## File map

### `src/types/lipd.ts`
All TypeScript interfaces. Key: `LipdColumn.values` is a runtime-only field (not in the JSON on disk). `LipdMetadata` uses `[key: string]: unknown` for extensibility.

### `src/lib/lipd.ts`
Core I/O and helpers.

- `parseLipd(file)` — reads ZIP, finds `.jsonld`, injects CSV values into `col.values`
- `serializeLipd(lipd)` — rebuilds ZIP with BagIt manifests; measurement CSVs are regenerated from `col.values`; ensemble/summary/distribution CSVs are kept from original `lipd.csvData`
- `injectValues(table, csvData)` — uses `col.number - 1` as CSV index, falls back to array index if `col.number` is missing (handles some real-world ensemble tables)
- `getColumns` — flat list of measurementTable columns with path; used by ColumnList
- `getTables` — flat list of measurementTable entries with path + label; used by DataEditor
- `updateCellValue` — immutably updates one cell, preserving all other `col.values` arrays via full deep-clone + re-attach pattern
- `bumpVersion / appendChangelog` — semantic version bump (patch), auto-called on save

### `src/lib/validate.ts`
Returns `Issue[]` from `validateLipd(metadata)`. Severity is `'error'` or `'warning'`. Checks: required fields, vocabulary conformance, geo coordinate ranges, DOI key casing, TSid uniqueness, missing CSV values.

### `src/lib/vocabulary.ts`
Arrays of valid strings for the LiPD controlled vocabularies: `ARCHIVE_TYPES`, `INTERP_VARIABLES`, `SEASONALITY`, `PROXY_TYPES`, `PROXY_GENERAL`, `UNITS`, `VARIABLE_NAMES`.

### `src/components/StructureView.tsx`
SVG-based interactive tree. Node types: `root | paleo | chron | model | measurement | ensemble | summary | distribution | col`. Layout uses leaf-centering (post-order y-assignment). Node IDs match `getTables()` path strings so "Data" buttons can pass them directly to DataEditor. Clicking a column node sets `selectedTSid` and switches the Plot tab.

### `src/components/DataEditor.tsx`
HTML `<table>` with click-to-edit cells. `selectedPath` prop (from StructureView "Data" button) syncs via `useEffect`. Only covers `measurementTable` entries (ensemble/distribution tables are read-only).

### `src/components/TimeSeriesPlot.tsx`
Imperative Plotly via `useEffect` + dynamic `import('plotly.js-dist-min')`. **Do not use react-plotly.js** — it crashes at module-init time with Plotly v3. ResizeObserver drives explicit pixel dimensions passed to Plotly.

### `src/components/ColumnList.tsx`
Accepts optional `className` prop. When `className="panel-sidebar"` the CSS overrides `flex: 1` and sets a fixed 190 px width for use inside `.panel-split`.

### `src/components/SiteMap.tsx`
React-Leaflet. Leaflet marker icons require explicit import workaround (already in place).

---

## CSS conventions

All styles live in `src/App.css`. Component-specific classes are prefixed with the component name (e.g. `.column-editor`, `.data-editor`, `.structure-view`).

Key layout classes:
- `.workspace-grid` — CSS Grid 35fr / 65fr columns, 1fr / 1fr rows
- `.panel-cell` — one grid cell (flex column)
- `.panel-tabbar` — mini tab row at top of cell
- `.panel-body` — scrollable/overflow content area (flex: 1, overflow: hidden)
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

The `col.values` array is loaded into memory on parse and stripped before writing `metadata.jsonld`. The CSV is rebuilt from `col.values` on serialise (measurement tables only; ensemble/distribution CSVs are preserved verbatim from `lipd.csvData`).

---

## Known gotchas

- **Plotly v3 + react-plotly.js**: incompatible. Always use the imperative pattern via `useEffect` + `import('plotly.js-dist-min')`. See `TimeSeriesPlot.tsx`.
- **`col.number` can be missing** in some real-world ensemble table columns. `injectValues` falls back to array index.
- **`stripValues`** only explicitly strips `measurementTable` columns (JSON clone strips everything; the explicit loop is for safety). Ensemble table values are not regenerated — only the original CSV text is re-packed.
- **`updateCellValue`** does a full JSON clone which strips all `col.values`, then re-attaches them from the original metadata object. This pattern must be preserved in any function that mutates metadata.
- **Leaflet marker icons** break with bundlers; the fix is already applied in `SiteMap.tsx`.

---

## What's implemented

- Open/save `.lpd` files (full BagIt-compliant round-trip)
- 2×2 panel layout: Metadata/Issues, Structure, Map/Plot, Column/Data
- Interactive SVG hierarchy tree (StructureView) with collapse/expand and "Data" shortcut buttons
- Time series scatter plot (Plotly, auto-detects age/year axis)
- Site map (Leaflet/OpenStreetMap)
- Column metadata editor (variableName, units, proxy, interpretation)
- Data table editor (click-to-edit cells, add/delete rows)
- Validation panel (errors + warnings against LiPD schema + controlled vocabularies)
- Changelog timeline with automatic versioned entries on save

## Planned / not yet done

- Tauri packaging for Mac/PC standalone distribution
- Ensemble table editing in DataEditor (currently read-only)
- Multi-file batch open
- Export to other formats (CSV, JSON-LD)
- Age model visualization
- Drag-to-reorder columns
