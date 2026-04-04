import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePlayback } from './PlaybackContext'
import type { PlaybackSpeed, PlaybackState, Stage } from '../types'

type PreziPhase = 'idle' | 'zooming-in' | 'drill-down' | 'zooming-out'

const DRILLABLE = new Set<string>(['problem', 'gap', 'kyc', 'trade', 'audit', 'integration'])
const DRILLABLE_ORDER = ['problem', 'gap', 'kyc', 'trade', 'audit', 'integration']

export interface DrillDownControls {
  play: () => void
  pause: () => void
  stepForward: () => void
  stepBackward: () => void
  setSpeed: (speed: PlaybackSpeed) => void
  state: PlaybackState
}

// ── Main Prezi context (phase, stage, navigation) ──────────────────────
// Changes rarely: phase transitions, stage changes.
// Consumed by DrillDownOverlay, ZoomController, PresentationLayout.

interface PreziContextValue {
  enabled: boolean
  phase: PreziPhase
  targetNodeId: string | null
  drillDownStage: Stage | null
  autoPlayDrillDown: boolean
  onDrillDownComplete: () => void
  goToDrillDown: (stage: Stage, autoPlay?: boolean) => void
  exitDrillDown: () => void
}

const PreziCtx = createContext<PreziContextValue | null>(null)

// ── Drill-down controls context (playback bridge) ──────────────────────
// Changes frequently: every step forward/backward, play/pause.
// Consumed ONLY by PlaybackBar – isolates re-renders from the overlay.

interface DrillDownControlsContextValue {
  controls: DrillDownControls | null
  register: (controls: DrillDownControls | null) => void
}

const DrillDownControlsCtx = createContext<DrillDownControlsContextValue>({
  controls: null,
  register: () => {},
})

// Inner provider for drill-down controls – sits inside PreziProvider
// but is a SEPARATE context, so updates don't cascade to PreziCtx consumers.
function DrillDownControlsProvider({ children }: { children: React.ReactNode }) {
  const [controls, setControls] = useState<DrillDownControls | null>(null)

  const register = useCallback((c: DrillDownControls | null) => {
    setControls(c)
  }, [])

  return (
    <DrillDownControlsCtx.Provider value={{ controls, register }}>
      {children}
    </DrillDownControlsCtx.Provider>
  )
}

// ── PreziProvider ──────────────────────────────────────────────────────

export function PreziProvider({ children }: { children: React.ReactNode }) {
  const { state, pause, play, goToStage, fastForwardToNode } = usePlayback()
  const [enabled] = useState(true)
  const [phase, setPhase] = useState<PreziPhase>('idle')
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null)
  const [drillDownStage, setDrillDownStage] = useState<Stage | null>(null)
  const [autoPlayDrillDown, setAutoPlayDrillDown] = useState(true)

  // Track which nodes we've already triggered drill-downs for
  const processedNodes = useRef<Set<string>>(new Set())

  // Detect when a drillable circle becomes active → pause overview + start zoom-in
  const { nodeStates, currentStage } = state.flowState
  useEffect(() => {
    if (!enabled || phase !== 'idle' || currentStage !== 'overview') return

    for (const [nodeId, nodeState] of Object.entries(nodeStates)) {
      if (
        nodeState === 'active' &&
        DRILLABLE.has(nodeId) &&
        !processedNodes.current.has(nodeId)
      ) {
        processedNodes.current.add(nodeId)
        pause()
        setTargetNodeId(nodeId)
        setDrillDownStage(nodeId as Stage)
        setAutoPlayDrillDown(true)
        setPhase('zooming-in')
        break
      }
    }
  }, [enabled, phase, nodeStates, currentStage, pause])

  // Phase transitions with timeouts
  useEffect(() => {
    if (phase === 'zooming-in') {
      const timer = setTimeout(() => setPhase('drill-down'), 900)
      return () => clearTimeout(timer)
    }
    if (phase === 'zooming-out') {
      const timer = setTimeout(() => {
        setPhase('idle')
        setTargetNodeId(null)
        setDrillDownStage(null)
      }, 900)
      return () => clearTimeout(timer)
    }
  }, [phase])

  // Resume overview auto-play after zoom-out completes (only if auto-triggered)
  const autoPlayDrillDownRef = useRef(autoPlayDrillDown)
  autoPlayDrillDownRef.current = autoPlayDrillDown
  useEffect(() => {
    if (phase === 'zooming-out') {
      const shouldResume = autoPlayDrillDownRef.current
      const timer = setTimeout(() => {
        if (shouldResume) {
          play()
        }
      }, 900)
      return () => clearTimeout(timer)
    }
  }, [phase, play])

  // Called by DrillDownOverlay when the drill-down sequence finishes
  // Always zoom out – auto-triggered will resume overview, manual stays paused
  const onDrillDownComplete = useCallback(() => {
    setPhase('zooming-out')
  }, [])

  // Manual navigation: jump to a drill-down stage
  // Fast-forwards the overview to the point where this stage is active
  const goToDrillDown = useCallback((stage: Stage, autoPlay = false) => {
    pause()
    // Fast-forward overview so all prior circles are green, target is gold
    fastForwardToNode(stage)
    // Mark all drillable stages up to and including target as processed
    // so auto-detection won't re-trigger them after zoom-out
    processedNodes.current.clear()
    for (const id of DRILLABLE_ORDER) {
      processedNodes.current.add(id)
      if (id === stage) break
    }
    setDrillDownStage(stage)
    setTargetNodeId(stage)
    setAutoPlayDrillDown(autoPlay)
    setPhase('drill-down')
  }, [pause, fastForwardToNode])

  // Exit drill-down and return to overview
  const exitDrillDown = useCallback(() => {
    setPhase('zooming-out')
    setAutoPlayDrillDown(false)
  }, [])

  // When overview auto-advances past its sequence, redirect to summary
  useEffect(() => {
    if (enabled && currentStage !== 'overview' && currentStage !== 'summary') {
      goToStage('summary')
    }
  }, [enabled, currentStage, goToStage])

  // Reset processed nodes on overview reset
  useEffect(() => {
    if (currentStage === 'overview' && state.flowState.currentStep === -1) {
      processedNodes.current.clear()
    }
  }, [currentStage, state.flowState.currentStep])

  return (
    <PreziCtx.Provider value={{
      enabled,
      phase,
      targetNodeId,
      drillDownStage,
      autoPlayDrillDown,
      onDrillDownComplete,
      goToDrillDown,
      exitDrillDown,
    }}>
      <DrillDownControlsProvider>
        {children}
      </DrillDownControlsProvider>
    </PreziCtx.Provider>
  )
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function usePrezi(): PreziContextValue {
  const ctx = useContext(PreziCtx)
  if (!ctx) throw new Error('usePrezi must be used within PreziProvider')
  return ctx
}

export function useDrillDownControls() {
  return useContext(DrillDownControlsCtx)
}
