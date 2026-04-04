import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePlayback } from './PlaybackContext'
import rawPositions from '../data/positions.json'
import rawOverrides from '../data/overrides.json'

// ─── Types ────────────────────────────────────────────────────

type PositionMap = Record<string, { x: number; y: number }>
type AllPositions = Record<string, PositionMap>

export interface SerializedEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type: string
  label?: string
}

export interface EdgeEndpoints {
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface StageOverrides {
  nodeLabels?: Record<string, string>
  edgeLabels?: Record<string, string>
  dimensions?: Record<string, { width: number; height: number }>
  addedEdges?: SerializedEdge[]
  deletedEdges?: string[]
  reconnectedEdges?: Record<string, Partial<EdgeEndpoints>>
}

type AllOverrides = Record<string, StageOverrides>

interface LabelEditingState {
  type: 'node' | 'edge'
  id: string
  label: string
  screenPos: { x: number; y: number }
  stageKey: string
}

// ─── Saved state (module-level, updated by HMR) ──────────────

const savedPositions = rawPositions as AllPositions
const savedOverrides = rawOverrides as AllOverrides

// ─── Context ──────────────────────────────────────────────────

interface LayoutEditorContextValue {
  editMode: boolean
  toggleEditMode: () => void

  // Positions
  draftPositions: AllPositions
  setNodePosition: (key: string, nodeId: string, pos: { x: number; y: number }) => void

  // Overrides
  draftOverrides: AllOverrides
  savedOverrides: AllOverrides
  setNodeLabel: (key: string, nodeId: string, label: string) => void
  setEdgeLabel: (key: string, edgeId: string, label: string) => void
  setNodeDimensions: (key: string, nodeId: string, dims: { width: number; height: number }) => void
  addEdge: (key: string, edge: SerializedEdge) => void
  deleteEdge: (key: string, edgeId: string) => void
  reconnectEdge: (key: string, edgeId: string, updates: Partial<EdgeEndpoints>) => void

  // Label editing
  labelEditing: LabelEditingState | null
  startLabelEdit: (type: 'node' | 'edge', id: string, label: string, screenPos: { x: number; y: number }, stageKey: string) => void
  commitLabelEdit: (newLabel: string) => void
  cancelLabelEdit: () => void

  // Save/reset
  saveToCode: () => Promise<void>
  resetAll: () => void
  hasUnsavedChanges: boolean
}

const LayoutEditorCtx = createContext<LayoutEditorContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────

export function LayoutEditorProvider({ children }: { children: React.ReactNode }) {
  const { pause } = usePlayback()
  const [editMode, setEditMode] = useState(false)
  const [draftPositions, setDraftPositions] = useState<AllPositions>({})
  const [draftOverrides, setDraftOverrides] = useState<AllOverrides>({})
  const [labelEditing, setLabelEditing] = useState<LabelEditingState | null>(null)

  const toggleEditMode = useCallback(() => {
    setEditMode(prev => {
      if (!prev) pause()
      return !prev
    })
    setLabelEditing(null)
  }, [pause])

  // ── Position setters ──

  const setNodePosition = useCallback((key: string, nodeId: string, pos: { x: number; y: number }) => {
    setDraftPositions(prev => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [nodeId]: pos },
    }))
  }, [])

  // ── Override setters ──

  const setNodeLabel = useCallback((key: string, nodeId: string, label: string) => {
    setDraftOverrides(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        nodeLabels: { ...(prev[key]?.nodeLabels || {}), [nodeId]: label },
      },
    }))
  }, [])

  const setEdgeLabel = useCallback((key: string, edgeId: string, label: string) => {
    setDraftOverrides(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        edgeLabels: { ...(prev[key]?.edgeLabels || {}), [edgeId]: label },
      },
    }))
  }, [])

  const setNodeDimensions = useCallback((key: string, nodeId: string, dims: { width: number; height: number }) => {
    setDraftOverrides(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        dimensions: { ...(prev[key]?.dimensions || {}), [nodeId]: dims },
      },
    }))
  }, [])

  const addEdge = useCallback((key: string, edge: SerializedEdge) => {
    setDraftOverrides(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        addedEdges: [...(prev[key]?.addedEdges || []), edge],
      },
    }))
  }, [])

  const deleteEdge = useCallback((key: string, edgeId: string) => {
    setDraftOverrides(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        deletedEdges: [...new Set([...(prev[key]?.deletedEdges || []), edgeId])],
      },
    }))
  }, [])

  const reconnectEdge = useCallback((key: string, edgeId: string, updates: Partial<EdgeEndpoints>) => {
    setDraftOverrides(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        reconnectedEdges: { ...(prev[key]?.reconnectedEdges || {}), [edgeId]: updates },
      },
    }))
  }, [])

  // ── Label editing ──

  const startLabelEdit = useCallback((
    type: 'node' | 'edge', id: string, label: string,
    screenPos: { x: number; y: number }, stageKey: string,
  ) => {
    setLabelEditing({ type, id, label, screenPos, stageKey })
  }, [])

  const commitLabelEdit = useCallback((newLabel: string) => {
    if (!labelEditing) return
    const { type, id, stageKey } = labelEditing
    if (type === 'node') setNodeLabel(stageKey, id, newLabel)
    else setEdgeLabel(stageKey, id, newLabel)
    setLabelEditing(null)
  }, [labelEditing, setNodeLabel, setEdgeLabel])

  const cancelLabelEdit = useCallback(() => {
    setLabelEditing(null)
  }, [])

  // ── Unsaved changes ──

  const hasUnsavedChanges = useMemo(() => {
    for (const [key, positions] of Object.entries(draftPositions)) {
      const sm = savedPositions[key] || {}
      for (const [id, pos] of Object.entries(positions)) {
        const sp = sm[id]
        if (!sp || sp.x !== pos.x || sp.y !== pos.y) return true
      }
    }
    for (const [key, draft] of Object.entries(draftOverrides)) {
      const s = savedOverrides[key]
      if (JSON.stringify(draft) !== JSON.stringify(s || {})) return true
    }
    return false
  }, [draftPositions, draftOverrides])

  // ── Save to code ──

  const saveToCode = useCallback(async () => {
    // Save positions
    for (const [key, positions] of Object.entries(draftPositions)) {
      const merged = { ...(savedPositions[key] || {}), ...positions }
      await fetch('/__layout/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'positions', key, data: merged }),
      })
    }
    // Save overrides
    for (const [key, draft] of Object.entries(draftOverrides)) {
      const existing = savedOverrides[key] || {}
      const merged: StageOverrides = {
        nodeLabels: { ...(existing.nodeLabels || {}), ...(draft.nodeLabels || {}) },
        edgeLabels: { ...(existing.edgeLabels || {}), ...(draft.edgeLabels || {}) },
        dimensions: { ...(existing.dimensions || {}), ...(draft.dimensions || {}) },
        addedEdges: dedupeById([...(existing.addedEdges || []), ...(draft.addedEdges || [])]),
        deletedEdges: [...new Set([...(existing.deletedEdges || []), ...(draft.deletedEdges || [])])],
        reconnectedEdges: { ...(existing.reconnectedEdges || {}), ...(draft.reconnectedEdges || {}) },
      }
      // Remove empty fields to keep JSON clean
      const cleaned = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => {
          if (Array.isArray(v)) return v.length > 0
          if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0
          return true
        }),
      )
      if (Object.keys(cleaned).length > 0) {
        await fetch('/__layout/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: 'overrides', key, data: cleaned }),
        })
      }
    }
  }, [draftPositions, draftOverrides])

  const resetAll = useCallback(() => {
    setDraftPositions({})
    setDraftOverrides({})
    setLabelEditing(null)
  }, [])

  const value = useMemo<LayoutEditorContextValue>(() => ({
    editMode, toggleEditMode,
    draftPositions, setNodePosition,
    draftOverrides, savedOverrides,
    setNodeLabel, setEdgeLabel, setNodeDimensions,
    addEdge, deleteEdge, reconnectEdge,
    labelEditing, startLabelEdit, commitLabelEdit, cancelLabelEdit,
    saveToCode, resetAll, hasUnsavedChanges,
  }), [editMode, toggleEditMode,
       draftPositions, setNodePosition,
       draftOverrides,
       setNodeLabel, setEdgeLabel, setNodeDimensions,
       addEdge, deleteEdge, reconnectEdge,
       labelEditing, startLabelEdit, commitLabelEdit, cancelLabelEdit,
       saveToCode, resetAll, hasUnsavedChanges])

  return (
    <LayoutEditorCtx.Provider value={value}>
      {children}
      {labelEditing && createPortal(
        <FloatingLabelEditor
          initial={labelEditing.label}
          screenPos={labelEditing.screenPos}
          onCommit={commitLabelEdit}
          onCancel={cancelLabelEdit}
        />,
        document.body,
      )}
    </LayoutEditorCtx.Provider>
  )
}

// ─── Floating label editor ────────────────────────────────────

function FloatingLabelEditor({ initial, screenPos, onCommit, onCancel }: {
  initial: string
  screenPos: { x: number; y: number }
  onCommit: (label: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)

  return (
    <div
      className="fixed z-[9999]"
      style={{ left: screenPos.x, top: screenPos.y }}
    >
      <div className="bg-surface-800 border border-amber-500/40 rounded-lg shadow-xl p-2 -translate-x-1/2 -translate-y-full mb-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommit(value)
            if (e.key === 'Escape') onCancel()
            e.stopPropagation()
          }}
          onBlur={() => onCommit(value)}
          autoFocus
          className="bg-surface-900 border border-slate-600 text-slate-200 text-sm px-2 py-1 rounded w-48 outline-none focus:border-amber-500"
          placeholder="Label..."
        />
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function dedupeById(edges: SerializedEdge[]): SerializedEdge[] {
  const map = new Map<string, SerializedEdge>()
  for (const e of edges) map.set(e.id, e)
  return Array.from(map.values())
}

export function useLayoutEditor(): LayoutEditorContextValue {
  const ctx = useContext(LayoutEditorCtx)
  if (!ctx) throw new Error('useLayoutEditor must be used within LayoutEditorProvider')
  return ctx
}
