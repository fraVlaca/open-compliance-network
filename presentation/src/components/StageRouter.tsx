import { AnimatePresence, motion } from 'motion/react'
import { usePlayback } from '../context/PlaybackContext'
import type { Stage } from '../types'

interface StageComponentMap {
  [key: string]: React.ComponentType
}

interface StageRouterProps {
  stages: StageComponentMap
}

const stageTitles: Record<Stage, string> = {
  overview: 'Compliance Engine Overview',
  problem: 'The Compliance Catch-22',
  gap: 'Provider Landscape & Gap',
  kyc: 'Identity Verification Flow',
  trade: 'Per-Trade Compliance Check',
  audit: 'Audit Trail & Trust Model',
  integration: 'Integration Patterns',
  summary: 'Key Metrics & Pitch',
}

export default function StageRouter({ stages }: StageRouterProps) {
  const { state } = usePlayback()
  const { currentStage } = state.flowState

  const StageComponent = stages[currentStage]

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStage}
        className="w-full h-full relative"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
      >
        {/* Stage title overlay */}
        <motion.div
          className="absolute top-4 left-6 z-10"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">
            {stageTitles[currentStage]}
          </span>
        </motion.div>

        {StageComponent ? (
          <StageComponent />
        ) : (
          <StagePlaceholder stage={currentStage} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function StagePlaceholder({ stage }: { stage: Stage }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-semibold text-slate-400 mb-2">
          {stageTitles[stage]}
        </div>
        <div className="text-sm text-slate-600">Stage implementation coming soon</div>
      </div>
    </div>
  )
}
