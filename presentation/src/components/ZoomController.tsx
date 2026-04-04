import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { usePrezi } from '../context/PreziContext'
import { useLayoutEditor } from '../context/LayoutEditorContext'

/**
 * Placed inside the overview ReactFlowProvider.
 * Zooms into a single node when the Prezi orchestrator triggers it,
 * and zooms back out when the drill-down completes.
 */
export default function ZoomController() {
  const { phase, targetNodeId } = usePrezi()
  const { fitView } = useReactFlow()
  const { editMode } = useLayoutEditor()

  useEffect(() => {
    if (editMode) return

    if (phase === 'zooming-in' && targetNodeId) {
      fitView({ nodes: [{ id: targetNodeId }], duration: 800, padding: 1.5 })
    } else if (phase === 'zooming-out') {
      fitView({ duration: 800, padding: 0.35 })
    }
  }, [phase, targetNodeId, fitView, editMode])

  return null
}
