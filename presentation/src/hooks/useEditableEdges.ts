import { useMemo, useCallback } from 'react'
import type { Edge, EdgeChange, OnEdgesChange, Connection } from '@xyflow/react'
import { useLayoutEditor } from '../context/LayoutEditorContext'
import rawOverrides from '../data/overrides.json'
import type { StageOverrides } from '../context/LayoutEditorContext'

const savedOverridesData = rawOverrides as Record<string, StageOverrides>

export function useEditableEdges(
  edges: Edge[],
  stage: string,
  mode = 'default',
): {
  editableEdges: Edge[]
  onEdgesChange: OnEdgesChange
  onConnect: (connection: Connection) => void
  onReconnect: (oldEdge: Edge, newConnection: Connection) => void
  onEdgeDoubleClick: (event: React.MouseEvent, edge: Edge) => void
} {
  const {
    editMode, draftOverrides,
    addEdge: addEdgeFn, deleteEdge: deleteEdgeFn, reconnectEdge: reconnectEdgeFn,
    startLabelEdit,
  } = useLayoutEditor()

  const key = `${stage}:${mode}`
  const savedOv = savedOverridesData[key]
  const draftOv = draftOverrides[key]

  const editableEdges = useMemo(() => {
    // Collect all deleted edge IDs
    const deletedSet = new Set([
      ...(savedOv?.deletedEdges || []),
      ...(draftOv?.deletedEdges || []),
    ])

    // Collect reconnection overrides
    const reconnected = {
      ...(savedOv?.reconnectedEdges || {}),
      ...(draftOv?.reconnectedEdges || {}),
    }

    // Collect label overrides
    const labelOverrides = {
      ...(savedOv?.edgeLabels || {}),
      ...(draftOv?.edgeLabels || {}),
    }

    // Process default edges – filter deleted, apply reconnections + label overrides
    const processed = edges
      .filter(e => !deletedSet.has(e.id))
      .map(e => {
        const recon = reconnected[e.id]
        const labelOv = labelOverrides[e.id]
        if (!recon && labelOv === undefined) return e
        return {
          ...e,
          ...(recon ? {
            source: recon.source ?? e.source,
            target: recon.target ?? e.target,
            sourceHandle: recon.sourceHandle ?? e.sourceHandle,
            targetHandle: recon.targetHandle ?? e.targetHandle,
          } : {}),
          data: labelOv !== undefined
            ? { ...e.data, label: labelOv }
            : e.data,
        }
      })

    // Add user-created edges
    const addedEdges: Edge[] = [
      ...(savedOv?.addedEdges || []),
      ...(draftOv?.addedEdges || []),
    ]
      .filter(e => !deletedSet.has(e.id))
      .map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        type: e.type || 'restEdge',
        data: {
          state: 'completed' as const,
          label: labelOverrides[e.id] ?? e.label ?? '',
        },
      }))

    return [...processed, ...addedEdges]
  }, [edges, savedOv, draftOv])

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (!editMode) return
      for (const change of changes) {
        if (change.type === 'remove') {
          deleteEdgeFn(key, change.id)
        }
      }
    },
    [editMode, key, deleteEdgeFn],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!editMode || !connection.source || !connection.target) return
      addEdgeFn(key, {
        id: `custom-${Date.now()}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        type: 'restEdge',
        label: '',
      })
    },
    [editMode, key, addEdgeFn],
  )

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!editMode) return
      reconnectEdgeFn(key, oldEdge.id, {
        source: newConnection.source ?? undefined,
        target: newConnection.target ?? undefined,
        sourceHandle: newConnection.sourceHandle ?? undefined,
        targetHandle: newConnection.targetHandle ?? undefined,
      })
    },
    [editMode, key, reconnectEdgeFn],
  )

  const onEdgeDoubleClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!editMode) return
      const currentLabel = (edge.data?.label || '') as string
      startLabelEdit('edge', edge.id, currentLabel, { x: event.clientX, y: event.clientY }, key)
    },
    [editMode, startLabelEdit, key],
  )

  return { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick }
}
