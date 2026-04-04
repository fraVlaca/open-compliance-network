import { useEffect, useMemo } from 'react'
import { ReactFlow, ReactFlowProvider } from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import { usePlayback } from '../context/PlaybackContext'
import { useLayoutEditor } from '../context/LayoutEditorContext'
import { useEditableNodes } from '../hooks/useEditableNodes'
import { useEditableEdges } from '../hooks/useEditableEdges'
import { nodeTypes } from '../nodes/nodeTypes'
import { edgeTypes } from '../edges/edgeTypes'
import AutoFitView from '../components/AutoFitView'
import type { StageSequence, FlowState, NodeState, EdgeState, SidePanelData } from '../types'

const sidePanels: Record<string, SidePanelData> = {
  sumsub: {
    stage: 'Gap', beat: 'Identity Layer', title: 'Sumsub',
    json: {
      'Capabilities': ['KYC / CDD', 'Sanctions screening (person)', 'PEP screening', 'Adverse media', 'Document verification'],
      'Cost': '$10-50K/year per organization',
      'Sharing': 'Reusable KYC Networks (identity only, not sanctions)',
      'Limitation': 'Source keys dashboard-only — no programmatic multi-tenant',
    },
    highlightFields: ['Limitation', 'Sharing'],
  },
  chainalysis: {
    stage: 'Gap', beat: 'Analytics Layer', title: 'Chainalysis',
    json: {
      'Capabilities': ['Deep wallet risk scoring', 'Counterparty screening', 'Transaction monitoring', 'Entity attribution', 'Exposure analysis (mixers, darknet, sanctioned)'],
      'Cost': '$100-500K/year per organization',
      'Sharing': 'ZERO sharing mechanism — each org screens independently',
      'Impact': '4 parties × $100-500K = $400K-2M/year for same wallets',
    },
    highlightFields: ['Sharing', 'Impact'],
  },
  gap: {
    stage: 'Gap', beat: 'The Missing Layer', title: 'What Nobody Offers',
    json: {
      'What nobody offers': {
        'Atomic per-trade orchestration': 'No provider combines KYC + wallet analytics + Travel Rule + jurisdiction into one atomic check',
        'Shared audit trail': 'No cross-provider unified record per trade. Regulator asks 4 parties, gets 4 partial answers.',
        'Verifiable execution': 'LP asks "did the protocol really screen this wallet?" — no way to verify.',
        'Elimination of redundancy': 'Chainalysis: zero sharing, $100-500K per org. 4 orgs screen the same wallets independently.',
      },
      'Total fragmentation cost': '$1.3-4.4M/year across 4 parties for the SAME compliance coverage',
      'The gap is NOT the checks': 'The providers exist. The checks exist. What\'s missing is the trust + coordination layer BETWEEN them.',
      'Next →': 'Open Compliance Layer fills this gap',
    },
    highlightFields: ['Missing', 'The gap'],
  },
}

function buildGapSequence(): StageSequence {
  return [
    { delay: 300, sidePanel: sidePanels.sumsub, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'active' as NodeState } }) },
    { delay: 1200, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'completed' as NodeState } }) },
    { delay: 400, sidePanel: sidePanels.chainalysis, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, chainalysis: 'active' as NodeState } }) },
    { delay: 1200, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, chainalysis: 'completed' as NodeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, notabene: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, notabene: 'completed' as NodeState } }) },
    { delay: 600, sidePanel: sidePanels.gap, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, gapTable: 'active' as NodeState }, edgeStates: { ...s.edgeStates, 'sumsub-gapTable': 'active' as EdgeState, 'chainalysis-gapTable': 'active' as EdgeState, 'notabene-gapTable': 'active' as EdgeState } }) },
    { delay: 1500, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, gapTable: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'sumsub-gapTable': 'completed' as EdgeState, 'chainalysis-gapTable': 'completed' as EdgeState, 'notabene-gapTable': 'completed' as EdgeState } }) },
  ]
}

export default function GapDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState
  const { editMode } = useLayoutEditor()

  useEffect(() => { registerSequence('gap', buildGapSequence()) }, [registerSequence])

  const nodes: Node[] = useMemo(() => [
    { id: 'sumsub', type: 'providerNode', position: { x: 50, y: 60 }, data: { label: 'Sumsub', provider: 'sumsub', purpose: 'KYC/CDD, Sanctions, PEP', state: nodeStates.sumsub || 'idle' }, draggable: false, selectable: false },
    { id: 'chainalysis', type: 'providerNode', position: { x: 280, y: 60 }, data: { label: 'Chainalysis', provider: 'chainalysis', purpose: 'Wallet risk, exposure, monitoring', state: nodeStates.chainalysis || 'idle' }, draggable: false, selectable: false },
    { id: 'notabene', type: 'providerNode', position: { x: 510, y: 60 }, data: { label: 'Notabene', provider: 'notabene', purpose: 'Travel Rule (IVMS101)', state: nodeStates.notabene || 'idle' }, draggable: false, selectable: false },
    { id: 'gapTable', type: 'comparisonNode', position: { x: 80, y: 240 }, data: {
      title: 'Fragmentation Gap — What Nobody Offers',
      columns: ['Capability', 'Sumsub', 'Chainalysis', 'Notabene', 'Shared?'],
      rows: [
        ['KYC / CDD', 'Yes', 'No', 'No', 'Partial'],
        ['Wallet risk scoring', 'Basic', 'Yes', 'No', 'No'],
        ['Counterparty screening', 'No', 'Yes', 'No', 'No'],
        ['Travel Rule', 'Basic', 'No', 'Yes', 'No'],
        ['Jurisdiction rules', 'No', 'No', 'No', 'N/A'],
        ['Per-trade orchestration', 'No', 'No', 'No', 'N/A'],
        ['Unified audit trail', 'No', 'No', 'No', 'N/A'],
        ['On-chain verifiability', 'No', 'No', 'No', 'N/A'],
      ],
      state: nodeStates.gapTable || 'idle',
    }, draggable: false, selectable: false },
  ], [nodeStates])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'gap')

  const edges: Edge[] = useMemo(() => [
    { id: 'sumsub-gapTable', source: 'sumsub', sourceHandle: 'bottom', target: 'gapTable', type: 'dataFlowEdge', data: { state: edgeStates['sumsub-gapTable'] || 'idle' } },
    { id: 'chainalysis-gapTable', source: 'chainalysis', sourceHandle: 'bottom', target: 'gapTable', type: 'dataFlowEdge', data: { state: edgeStates['chainalysis-gapTable'] || 'idle' } },
    { id: 'notabene-gapTable', source: 'notabene', sourceHandle: 'bottom', target: 'gapTable', type: 'dataFlowEdge', data: { state: edgeStates['notabene-gapTable'] || 'idle' } },
  ], [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'gap')

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow nodes={editableNodes} edges={editableEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onReconnect={onReconnect} onNodeDoubleClick={onNodeDoubleClick} onEdgeDoubleClick={onEdgeDoubleClick} edgesReconnectable={editMode} deleteKeyCode={editMode ? 'Backspace' : null} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={editMode} nodesConnectable={editMode} panOnDrag={!editMode} zoomOnScroll={editMode} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} fitView fitViewOptions={{ padding: 0.15 }} proOptions={{ hideAttribution: true }} className="bg-surface-900">
          <AutoFitView trigger={nodeStates} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
