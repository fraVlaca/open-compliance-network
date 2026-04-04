import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'
import type {
  FlowState,
  PlaybackAction,
  PlaybackSpeed,
  PlaybackState,
  SidePanelData,
  Stage,
  StageSequence,
  NodeState,
  EdgeState,
} from '../types'
import { STAGES } from '../types'

const initialFlowState: FlowState = {
  currentStage: 'overview',
  currentStep: -1,
  nodeStates: {},
  edgeStates: {},
  stageData: {},
  sidePanelData: null,
}

const initialState: PlaybackState = {
  flowState: initialFlowState,
  playing: false,
  speed: 1,
  stageSequences: {
    overview: [],
    problem: [],
    gap: [],
    kyc: [],
    trade: [],
    audit: [],
    integration: [],
    summary: [],
  },
}

function reducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'PLAY':
      return { ...state, playing: true }

    case 'PAUSE':
      return { ...state, playing: false }

    case 'SET_PLAYING':
      return { ...state, playing: action.playing }

    case 'RESET':
      return {
        ...state,
        playing: false,
        flowState: { ...initialFlowState },
      }

    case 'SET_SPEED':
      return { ...state, speed: action.speed }

    case 'SET_FLOW_STATE':
      return { ...state, flowState: action.flowState }

    case 'STEP_FORWARD':
    case 'STEP_BACKWARD':
      // Handled imperatively outside the reducer (need sequence ref)
      return state

    case 'GO_TO_STAGE':
      return {
        ...state,
        playing: false,
        flowState: {
          ...state.flowState,
          currentStage: action.stage,
          currentStep: -1,
          nodeStates: {},
          edgeStates: {},
          stageData: {},
          sidePanelData: null,
        },
      }

    case 'UPDATE_NODE':
      return {
        ...state,
        flowState: {
          ...state.flowState,
          nodeStates: { ...state.flowState.nodeStates, [action.nodeId]: action.state },
        },
      }

    case 'UPDATE_EDGE':
      return {
        ...state,
        flowState: {
          ...state.flowState,
          edgeStates: { ...state.flowState.edgeStates, [action.edgeId]: action.state },
        },
      }

    case 'SET_SIDE_PANEL':
      return {
        ...state,
        flowState: { ...state.flowState, sidePanelData: action.data },
      }

    case 'APPLY_ACTION': {
      const updates = action.action.apply(state.flowState)
      return {
        ...state,
        flowState: {
          ...state.flowState,
          ...updates,
          sidePanelData: action.action.sidePanel !== undefined ? action.action.sidePanel : state.flowState.sidePanelData,
        },
      }
    }

    case 'SET_STAGE_DATA':
      return {
        ...state,
        flowState: {
          ...state.flowState,
          stageData: { ...state.flowState.stageData, [action.key]: action.value },
        },
      }

    default:
      return state
  }
}

// Compute the next state after stepping forward using the given sequence store
type SequenceStore = Record<Stage, StageSequence>

function computeStepForward(state: PlaybackState, sequences: SequenceStore): PlaybackState {
  const sequence = sequences[state.flowState.currentStage]
  const nextStep = state.flowState.currentStep + 1

  if (nextStep >= sequence.length) {
    const stageIndex = STAGES.findIndex(s => s.id === state.flowState.currentStage)
    if (stageIndex < STAGES.length - 1) {
      const nextStage = STAGES[stageIndex + 1].id
      return {
        ...state,
        flowState: {
          ...state.flowState,
          currentStage: nextStage,
          currentStep: -1,
          nodeStates: {},
          edgeStates: {},
          stageData: {},
          sidePanelData: null,
        },
      }
    }
    return { ...state, playing: false }
  }

  const stageAction = sequence[nextStep]
  const updates = stageAction.apply(state.flowState)
  return {
    ...state,
    flowState: {
      ...state.flowState,
      ...updates,
      currentStep: nextStep,
      sidePanelData: stageAction.sidePanel !== undefined ? stageAction.sidePanel : state.flowState.sidePanelData,
    },
  }
}

function computeStepBackward(state: PlaybackState, sequences: SequenceStore): PlaybackState {
  const prevStep = state.flowState.currentStep - 1
  if (prevStep < -1) return state

  const sequence = sequences[state.flowState.currentStage]
  let flowState: FlowState = {
    ...initialFlowState,
    currentStage: state.flowState.currentStage,
  }
  for (let i = 0; i <= prevStep; i++) {
    const sa = sequence[i]
    const updates = sa.apply(flowState)
    flowState = {
      ...flowState,
      ...updates,
      currentStep: i,
      sidePanelData: sa.sidePanel !== undefined ? sa.sidePanel : flowState.sidePanelData,
    }
  }
  if (prevStep < 0) {
    flowState.currentStep = -1
  }
  return { ...state, flowState }
}

interface PlaybackContextValue {
  state: PlaybackState
  play: () => void
  pause: () => void
  reset: () => void
  setSpeed: (speed: PlaybackSpeed) => void
  stepForward: () => void
  stepBackward: () => void
  goToStage: (stage: Stage) => void
  /** Replay the current stage's sequence until nodeId becomes 'active', then pause there */
  fastForwardToNode: (nodeId: string) => void
  setSidePanelData: (data: SidePanelData | null) => void
  updateNodeState: (nodeId: string, state: NodeState) => void
  updateEdgeState: (edgeId: string, state: EdgeState) => void
  registerSequence: (stage: Stage, sequence: StageSequence) => void
}

const PlaybackCtx = createContext<PlaybackContextValue | null>(null)

interface PlaybackProviderProps {
  children: React.ReactNode
  /** Only play this one stage – don't advance to the next */
  singleStage?: boolean
  /** Start on this stage instead of 'overview' */
  initialStage?: Stage
  /** Automatically start playing once the stage sequence is registered */
  autoPlay?: boolean
  /** Speed for auto-play */
  initialSpeed?: PlaybackSpeed
  /** Called when the stage's sequence finishes (only with singleStage) */
  onPlaybackComplete?: () => void
}

export function PlaybackProvider({
  children,
  singleStage,
  initialStage,
  autoPlay: autoPlayProp,
  initialSpeed,
  onPlaybackComplete,
}: PlaybackProviderProps) {
  const [state, dispatch] = useReducer(
    reducer,
    { initialStage, initialSpeed },
    (args: { initialStage?: Stage; initialSpeed?: PlaybackSpeed }) => ({
      ...initialState,
      flowState: {
        ...initialFlowState,
        currentStage: args.initialStage || 'overview',
      },
      speed: args.initialSpeed || 1,
    }),
  )
  const stateRef = useRef(state)
  stateRef.current = state

  const singleStageRef = useRef(singleStage)
  singleStageRef.current = singleStage
  const onPlaybackCompleteRef = useRef(onPlaybackComplete)
  onPlaybackCompleteRef.current = onPlaybackComplete

  // Separate ref for sequences – never overwritten by reducer state
  const sequencesRef = useRef<SequenceStore>({ ...initialState.stageSequences })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const doStepForward = useCallback(() => {
    const current = stateRef.current
    const sequence = sequencesRef.current[current.flowState.currentStage]
    const nextStep = current.flowState.currentStep + 1

    // In singleStage mode (drill-down), signal completion at end of sequence
    if (singleStageRef.current && nextStep >= sequence.length) {
      onPlaybackCompleteRef.current?.()
      return
    }

    const next = computeStepForward(current, sequencesRef.current)
    stateRef.current = next
    dispatch({ type: 'SET_FLOW_STATE', flowState: next.flowState })
    if (!next.playing && current.playing) {
      dispatch({ type: 'SET_PLAYING', playing: false })
    }
  }, [])

  const doStepBackward = useCallback(() => {
    const next = computeStepBackward(stateRef.current, sequencesRef.current)
    stateRef.current = next
    dispatch({ type: 'SET_FLOW_STATE', flowState: next.flowState })
  }, [])

  // Replay the current stage's sequence until the given node becomes 'active'
  const doFastForwardToNode = useCallback((nodeId: string) => {
    clearTimer()
    const current = stateRef.current
    const stage = current.flowState.currentStage
    const sequence = sequencesRef.current[stage]

    let flowState: FlowState = {
      ...initialFlowState,
      currentStage: stage,
    }

    for (let i = 0; i < sequence.length; i++) {
      const sa = sequence[i]
      const updates = sa.apply(flowState)
      flowState = {
        ...flowState,
        ...updates,
        currentStep: i,
        sidePanelData: sa.sidePanel !== undefined ? sa.sidePanel : flowState.sidePanelData,
      }
      if (flowState.nodeStates[nodeId] === 'active') break
    }

    const next = { ...current, playing: false, flowState }
    stateRef.current = next
    dispatch({ type: 'SET_FLOW_STATE', flowState })
    dispatch({ type: 'SET_PLAYING', playing: false })
  }, [clearTimer])

  const scheduleNext = useCallback(() => {
    clearTimer()
    const { flowState, speed } = stateRef.current
    const sequence = sequencesRef.current[flowState.currentStage]
    const nextStep = flowState.currentStep + 1

    if (nextStep >= sequence.length) {
      // In single-stage mode (drill-down overlay), don't advance – just stop
      if (singleStageRef.current) {
        dispatch({ type: 'PAUSE' })
        onPlaybackCompleteRef.current?.()
        return
      }

      const stageIndex = STAGES.findIndex(s => s.id === flowState.currentStage)
      if (stageIndex < STAGES.length - 1) {
        const nextStageId = STAGES[stageIndex + 1].id
        timerRef.current = setTimeout(() => {
          doStepForward()
          // Wait for new stage component to mount and register its sequence.
          // AnimatePresence mode="wait" delays mount by ~600ms (exit animation),
          // so poll until the sequence is available.
          const pollForSequence = () => {
            if (!stateRef.current.playing) return
            const seq = sequencesRef.current[nextStageId]
            if (seq && seq.length > 0) {
              scheduleNext()
            } else {
              setTimeout(pollForSequence, 50)
            }
          }
          setTimeout(pollForSequence, 50)
        }, 800 / speed)
      } else {
        // Loop: reset to beginning, poll for sequence re-registration, then restart
        clearTimer()
        dispatch({ type: 'RESET' })
        setTimeout(() => {
          const poll = setInterval(() => {
            const seq = sequencesRef.current['overview']
            if (seq && seq.length > 0) {
              clearInterval(poll)
              dispatch({ type: 'PLAY' })
            }
          }, 100)
        }, 1500)
      }
      return
    }

    const nextAction = sequence[nextStep]
    const delay = nextAction.delay / speed

    timerRef.current = setTimeout(() => {
      doStepForward()
      if (stateRef.current.playing) {
        scheduleNext()
      }
    }, delay)
  }, [clearTimer, doStepForward])

  // Start/stop auto-play timer
  useEffect(() => {
    if (state.playing) {
      scheduleNext()
    } else {
      clearTimer()
    }
    return clearTimer
  }, [state.playing, state.speed, clearTimer, scheduleNext])

  // Auto-play: poll for sequence registration, then start playing
  useEffect(() => {
    if (!autoPlayProp) return
    const targetStage = initialStage || 'overview'
    const poll = setInterval(() => {
      const seq = sequencesRef.current[targetStage]
      if (seq && seq.length > 0) {
        clearInterval(poll)
        dispatch({ type: 'PLAY' })
      }
    }, 50)
    return () => clearInterval(poll)
  }, [autoPlayProp, initialStage])

  const registerSequence = useCallback((stage: Stage, sequence: StageSequence) => {
    sequencesRef.current = {
      ...sequencesRef.current,
      [stage]: sequence,
    }
  }, [])

  const value: PlaybackContextValue = {
    state: { ...state, stageSequences: sequencesRef.current },
    play: () => dispatch({ type: 'PLAY' }),
    pause: () => dispatch({ type: 'PAUSE' }),
    reset: () => { clearTimer(); dispatch({ type: 'RESET' }) },
    setSpeed: (speed) => dispatch({ type: 'SET_SPEED', speed }),
    stepForward: doStepForward,
    stepBackward: doStepBackward,
    goToStage: (stage) => { clearTimer(); dispatch({ type: 'GO_TO_STAGE', stage }) },
    fastForwardToNode: doFastForwardToNode,
    setSidePanelData: (data) => dispatch({ type: 'SET_SIDE_PANEL', data }),
    updateNodeState: (nodeId, nodeState) => dispatch({ type: 'UPDATE_NODE', nodeId, state: nodeState }),
    updateEdgeState: (edgeId, edgeState) => dispatch({ type: 'UPDATE_EDGE', edgeId, state: edgeState }),
    registerSequence,
  }

  return <PlaybackCtx.Provider value={value}>{children}</PlaybackCtx.Provider>
}

export function usePlayback(): PlaybackContextValue {
  const ctx = useContext(PlaybackCtx)
  if (!ctx) throw new Error('usePlayback must be used within PlaybackProvider')
  return ctx
}
