import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { PlaybackProvider, usePlayback } from '../context/PlaybackContext'
import { usePrezi, useDrillDownControls } from '../context/PreziContext'
import type { Stage } from '../types'

const stageTitles: Record<string, string> = {
  problem: 'The Compliance Catch-22',
  gap: 'Provider Landscape & Gap',
  kyc: 'Identity Verification Flow',
  trade: 'Per-Trade Compliance Check',
  audit: 'Audit Trail & Trust Model',
  integration: 'Integration Patterns',
}

interface DrillDownOverlayProps {
  stageComponents: Record<string, React.ComponentType>
}

/**
 * Renders the active drill-down stage as a full-screen overlay on top of the overview.
 * Uses a nested PlaybackProvider so the drill-down has its own independent playback state.
 */
export default function DrillDownOverlay({ stageComponents }: DrillDownOverlayProps) {
  const { phase, drillDownStage, autoPlayDrillDown, onDrillDownComplete } = usePrezi()
  const { state } = usePlayback() // outer (overview) provider – read speed

  const showOverlay = (phase === 'drill-down' || phase === 'zooming-out') && drillDownStage

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          key={drillDownStage}
          className="absolute inset-0 z-20 bg-surface-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <PlaybackProvider
            singleStage
            initialStage={drillDownStage}
            autoPlay={autoPlayDrillDown}
            initialSpeed={state.speed}
            onPlaybackComplete={onDrillDownComplete}
          >
            <DrillDownBridge />
            <DrillDownContent stage={drillDownStage} stageComponents={stageComponents} />
          </PlaybackProvider>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Bridge component: registers the inner PlaybackProvider's controls into
 * DrillDownControlsContext (separate from PreziContext) so that the outer
 * PlaybackBar can read and control the drill-down's playback state
 * WITHOUT triggering re-renders in DrillDownOverlay.
 */
function DrillDownBridge() {
  const { state, play, pause, stepForward, stepBackward, setSpeed } = usePlayback()
  const { register } = useDrillDownControls()

  useEffect(() => {
    register({ play, pause, stepForward, stepBackward, setSpeed, state })
  }, [state.playing, state.flowState.currentStep, state.speed, play, pause, stepForward, stepBackward, setSpeed, register])

  useEffect(() => {
    return () => register(null)
  }, [register])

  return null
}

function DrillDownContent({
  stage,
  stageComponents,
}: {
  stage: Stage
  stageComponents: Record<string, React.ComponentType>
}) {
  const StageComponent = stageComponents[stage]
  if (!StageComponent) return null

  return (
    <div className="w-full h-full relative">
      {/* Stage title */}
      <motion.div
        className="absolute top-4 left-6 z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
          {stageTitles[stage] || stage}
        </span>
      </motion.div>
      <StageComponent />
    </div>
  )
}
