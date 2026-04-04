export type Stage = 'overview' | 'problem' | 'gap' | 'kyc' | 'trade' | 'audit' | 'integration' | 'summary'

export type NodeState = 'idle' | 'active' | 'completed' | 'failed'
export type EdgeState = 'idle' | 'active' | 'completed'

export interface FlowState {
  currentStage: Stage
  currentStep: number
  nodeStates: Record<string, NodeState>
  edgeStates: Record<string, EdgeState>
  stageData: Record<string, unknown>
  sidePanelData: SidePanelData | null
}

export interface SidePanelData {
  stage: string
  beat: string
  title: string
  json: unknown
  highlightFields: string[]
}

export interface StageAction {
  delay: number
  apply: (state: FlowState) => Partial<FlowState>
  sidePanel?: SidePanelData | null
}

export type StageSequence = StageAction[]

export type PlaybackSpeed = 0.5 | 1 | 2

export interface PlaybackState {
  flowState: FlowState
  playing: boolean
  speed: PlaybackSpeed
  stageSequences: Record<Stage, StageSequence>
}

export type PlaybackAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'SET_SPEED'; speed: PlaybackSpeed }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'GO_TO_STAGE'; stage: Stage }
  | { type: 'UPDATE_NODE'; nodeId: string; state: NodeState }
  | { type: 'UPDATE_EDGE'; edgeId: string; state: EdgeState }
  | { type: 'SET_SIDE_PANEL'; data: SidePanelData | null }
  | { type: 'APPLY_ACTION'; action: StageAction }
  | { type: 'SET_STAGE_DATA'; key: string; value: unknown }
  | { type: 'SET_FLOW_STATE'; flowState: FlowState }
  | { type: 'SET_PLAYING'; playing: boolean }

export interface StageConfig {
  id: Stage
  label: string
  color: string
}

export const STAGES: StageConfig[] = [
  { id: 'overview', label: 'Overview', color: 'slate-400' },
  { id: 'problem', label: 'Problem', color: 'negative-500' },
  { id: 'gap', label: 'Gap', color: 'warning-500' },
  { id: 'kyc', label: 'KYC Flow', color: 'tee-500' },
  { id: 'trade', label: 'Trade Flow', color: 'primary-500' },
  { id: 'audit', label: 'Audit & Trust', color: 'positive-500' },
  { id: 'integration', label: 'Integration', color: 'chain-500' },
  { id: 'summary', label: 'Summary', color: 'slate-400' },
]
