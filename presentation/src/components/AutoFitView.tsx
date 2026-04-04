import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useLayoutEditor } from '../context/LayoutEditorContext'

/**
 * Triggers fitView when the trigger value changes.
 * Must be rendered inside <ReactFlowProvider>.
 * Skips fitView when layout edit mode is active.
 */
export default function AutoFitView({ trigger, padding = 0.18 }: { trigger: unknown; padding?: number }) {
  const { fitView } = useReactFlow()
  const { editMode } = useLayoutEditor()
  useEffect(() => {
    if (editMode) return
    const t = setTimeout(() => fitView({ padding, duration: 400 }), 150)
    return () => clearTimeout(t)
  }, [trigger, fitView, padding, editMode])
  return null
}
