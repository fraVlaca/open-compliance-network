import { useEffect, useMemo } from 'react'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import { usePlayback } from '../context/PlaybackContext'
import { useLayoutEditor } from '../context/LayoutEditorContext'
import { useEditableNodes } from '../hooks/useEditableNodes'
import { useEditableEdges } from '../hooks/useEditableEdges'
import { nodeTypes } from '../nodes/nodeTypes'
import { edgeTypes } from '../edges/edgeTypes'
import ZoomController from '../components/ZoomController'
import type { Stage, StageSequence, FlowState, NodeState, EdgeState } from '../types'

const LIFECYCLE_STAGES = [
  { id: 'problem', label: 'Problem', stageId: 'problem' },
  { id: 'gap', label: 'Gap', stageId: 'gap' },
  { id: 'kyc', label: 'KYC Flow', stageId: 'kyc' },
  { id: 'trade', label: 'Trade Flow', stageId: 'trade' },
  { id: 'audit', label: 'Audit & Trust', stageId: 'audit' },
  { id: 'integration', label: 'Integration', stageId: 'integration' },
]

const DRILLABLE = new Set(['problem', 'gap', 'kyc', 'trade', 'audit', 'integration'])

const overviewSidePanel = {
  stage: 'Overview',
  beat: 'Reference',
  title: 'Open Compliance Layer',
  json: {
    'The problem': 'DeFi protocols can\'t add KYC without destroying decentralization (the compliance catch-22)',
    'The solution': 'A compliance oracle — protocols read attestations like Chainlink price feeds. They never touch PII, never run KYC infrastructure, never become regulated entities.',
    'How it works': 'CRE workflows → Sumsub + Chainalysis → on-chain credential + IPFS audit trail',
    'Integration': {
      'Simplest': 'require(consumer.isVerified(wallet))  // 1 line of Solidity',
      'ACE': 'function trade() external runPolicy { }',
      'Async': 'emit ComplianceCheckRequested(...)  // CRE auto-callbacks',
    },
    'Deployed on': 'Arc Testnet (Circle) — USDC-native, institutional-first',
    'Providers': ['Sumsub (KYC/AML/Sanctions)', 'Chainalysis (wallet risk/exposure)', 'Notabene (Travel Rule)'],
  },
  highlightFields: ['The problem', 'The solution', 'Integration'],
}

function buildOverviewSequence(): StageSequence {
  const stages = LIFECYCLE_STAGES
  const actions: StageSequence = []

  actions.push({
    delay: 200,
    sidePanel: overviewSidePanel,
    apply: (s: FlowState) => ({
      nodeStates: { ...s.nodeStates, [stages[0].id]: 'active' as NodeState },
    }),
  })

  for (let i = 0; i < stages.length; i++) {
    const current = stages[i]
    const next = stages[i + 1]
    const edgeId = next ? `${current.id}-${next.id}` : null

    const holdMs =
      current.id === 'trade' ? 1200 :
      current.id === 'kyc' || current.id === 'audit' ? 1000 :
      current.id === 'problem' || current.id === 'solution' ? 800 :
      600

    if (next) {
      actions.push({
        delay: holdMs,
        apply: (s: FlowState) => ({
          nodeStates: { ...s.nodeStates, [current.id]: 'completed' as NodeState },
          edgeStates: { ...s.edgeStates, [edgeId!]: 'active' as EdgeState },
        }),
      })
      actions.push({
        delay: 400,
        apply: (s: FlowState) => ({
          edgeStates: { ...s.edgeStates, [edgeId!]: 'completed' as EdgeState },
          nodeStates: { ...s.nodeStates, [next.id]: 'active' as NodeState },
        }),
      })
    } else {
      actions.push({
        delay: holdMs,
        apply: (s: FlowState) => ({
          nodeStates: { ...s.nodeStates, [current.id]: 'completed' as NodeState },
        }),
      })
    }
  }

  return actions
}

export default function OverviewStage() {
  const { state, registerSequence, goToStage } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState

  useEffect(() => {
    registerSequence('overview', buildOverviewSequence())
  }, [registerSequence])

  const handleStageClick = (stageId: string) => {
    if (DRILLABLE.has(stageId)) {
      goToStage(stageId as Stage)
    }
  }

  const nodes: Node[] = useMemo(() => {
    const spacing = 160
    const startX = 20
    const y = 160

    return LIFECYCLE_STAGES.map((stage, i) => ({
      id: stage.id,
      type: 'stageNode',
      position: { x: startX + i * spacing, y },
      data: {
        label: stage.label,
        state: (nodeStates[stage.id] as NodeState) || 'idle',
        stageId: stage.stageId,
        onClick: handleStageClick,
      },
      draggable: false,
      selectable: false,
    }))
  }, [nodeStates])

  const { editMode } = useLayoutEditor()
  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'overview')

  const edges: Edge[] = useMemo(() => {
    return LIFECYCLE_STAGES.slice(0, -1).map((stage, i) => {
      const next = LIFECYCLE_STAGES[i + 1]
      const edgeId = `${stage.id}-${next.id}`
      return {
        id: edgeId,
        source: stage.id,
        target: next.id,
        type: 'dataFlowEdge',
        data: { state: (edgeStates[edgeId] as EdgeState) || 'idle' },
      }
    })
  }, [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'overview')

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={editableNodes}
          edges={editableEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          edgesReconnectable={editMode}
          deleteKeyCode={editMode ? 'Backspace' : null}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={editMode}
          nodesConnectable={editMode}
          panOnDrag={!editMode}
          zoomOnScroll={editMode}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          fitView={!editMode}
          fitViewOptions={{ padding: 0.35 }}
          proOptions={{ hideAttribution: true }}
          className="bg-surface-900"
        >
          <ZoomController />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
