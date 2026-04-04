import { useMemo, useCallback } from 'react'
import type { Node, NodeChange, OnNodesChange } from '@xyflow/react'
import { useLayoutEditor } from '../context/LayoutEditorContext'
import rawPositions from '../data/positions.json'
import rawOverrides from '../data/overrides.json'
import type { StageOverrides } from '../context/LayoutEditorContext'

type PositionMap = Record<string, { x: number; y: number }>
const savedPositions = rawPositions as Record<string, PositionMap>
const savedOverridesData = rawOverrides as Record<string, StageOverrides>

export function useEditableNodes(
  nodes: Node[],
  stage: string,
  mode = 'default',
): {
  editableNodes: Node[]
  onNodesChange: OnNodesChange
  onNodeDoubleClick: (event: React.MouseEvent, node: Node) => void
} {
  const {
    editMode, draftPositions, setNodePosition,
    draftOverrides, startLabelEdit, setNodeDimensions,
  } = useLayoutEditor()

  const key = `${stage}:${mode}`
  const savedPos = savedPositions[key] || {}
  const draftPos = draftPositions[key] || {}
  const savedOv = savedOverridesData[key]
  const draftOv = draftOverrides[key]

  const editableNodes = useMemo(
    () =>
      nodes.map(node => {
        // Position: draft > saved > hardcoded
        const position = draftPos[node.id] || savedPos[node.id] || node.position

        // Label override: draft > saved
        const labelOverride = draftOv?.nodeLabels?.[node.id] ?? savedOv?.nodeLabels?.[node.id]

        // Dimension override: draft > saved
        const dimsOverride = draftOv?.dimensions?.[node.id] ?? savedOv?.dimensions?.[node.id]

        // Build data – override all common label fields if label is overridden
        const data = labelOverride !== undefined
          ? { ...node.data, label: labelOverride, chainName: labelOverride, title: labelOverride, name: labelOverride }
          : node.data

        return {
          ...node,
          position,
          data: editMode ? { ...data, _editMode: true } : data,
          style: dimsOverride
            ? { ...node.style, width: dimsOverride.width, height: dimsOverride.height }
            : node.style,
          draggable: editMode,
          selectable: editMode,
        }
      }),
    [nodes, editMode, draftPos, savedPos, draftOv, savedOv],
  )

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (!editMode) return
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          setNodePosition(key, change.id, change.position)
        }
        // Capture resize from NodeResizer
        if (
          change.type === 'dimensions' &&
          'resizing' in change && change.resizing &&
          'dimensions' in change && change.dimensions
        ) {
          setNodeDimensions(key, change.id, change.dimensions as { width: number; height: number })
        }
      }
    },
    [editMode, key, setNodePosition, setNodeDimensions],
  )

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!editMode) return
      const currentLabel = (node.data.label || node.data.chainName || node.data.title || node.data.name || '') as string
      startLabelEdit('node', node.id, currentLabel, { x: event.clientX, y: event.clientY }, key)
    },
    [editMode, startLabelEdit, key],
  )

  return { editableNodes, onNodesChange, onNodeDoubleClick }
}
