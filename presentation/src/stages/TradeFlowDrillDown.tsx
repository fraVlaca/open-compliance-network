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
  submit: {
    stage: 'Trade Flow', beat: 'Trade Submission', title: 'User Calls swap()',
    json: {
      'User action': 'swap(counterparty, USDC, 100000)',
      'Single tx': 'User submits ONE transaction — no second tx needed',
      'Contract': 'Stores pending trade + emits ComplianceCheckRequested event',
      'Event': 'ComplianceCheckRequested(tradeId, trader, counterparty, asset, amount)',
      'CRE detects': 'EVM Log Trigger picks up event within seconds',
    },
    highlightFields: ['Single tx', 'Event'],
  },
  checks: {
    stage: 'Trade Flow', beat: 'Compliance Checks', title: 'CRE Workflow B',
    json: {
      'Triggered by': 'EVM Log — ComplianceCheckRequested event',
      'Namespace': 'externalUserId = {workspaceId}:{brokerAppId}:{trader}',
      'Parallel checks': {
        'Sumsub': 'Trader KYC status, sanctions, PEP',
        'Chainalysis (trader)': 'Wallet risk score + exposure',
        'Chainalysis (counterparty)': 'Counterparty wallet risk',
      },
      'Rules engine (open source)': { 'Jurisdiction': 'MiCA: DE → allowed', 'Asset': 'USDC → eligible', 'Threshold': 'Below EDD limit', 'Structuring': 'No pattern detected' },
      'Structuring detection': 'Cross-reference trade patterns to detect threshold evasion',
    },
    highlightFields: ['Parallel checks', 'Rules engine (open source)'],
  },
  report: {
    stage: 'Trade Flow', beat: 'Report + Auto-Callback', title: 'Auto-Execution',
    json: {
      'ComplianceReport (on-chain)': { tradeId: '0xabc...', trader: '0xUser', counterparty: '0xLP', sourceContract: '0xSwap', approved: true, riskScore: 2, auditHash: '0x9f2e...', ipfsCid: 'QmXyz...' },
      'IPFS': 'Full AuditRecord uploaded via Pinata — content-addressed',
      'Auto-callback': 'ComplianceReportConsumer.onReport() → onComplianceApproved(tradeId) or onComplianceRejected(tradeId, reason)',
      'Result': 'One user tx → CRE checks → DON consensus → auto-callback → trade done',
    },
    highlightFields: ['Auto-callback', 'Result'],
  },
}

function buildTradeSequence(): StageSequence {
  return [
    { delay: 300, sidePanel: sidePanels.submit, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, user: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, user: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'user-swap': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'user-swap': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, swap: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, swap: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'swap-cre': 'active' as EdgeState } }) },
    { delay: 500, sidePanel: sidePanels.checks, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'swap-cre': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, cre: 'active' as NodeState, teeContainer: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-sumsub': 'active' as EdgeState, 'cre-ch-trader': 'active' as EdgeState, 'cre-ch-counter': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'active' as NodeState, chTrader: 'active' as NodeState, chCounter: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'completed' as NodeState, chTrader: 'completed' as NodeState, chCounter: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'cre-sumsub': 'completed' as EdgeState, 'cre-ch-trader': 'completed' as EdgeState, 'cre-ch-counter': 'completed' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-rules': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-rules': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, rules: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, rules: 'completed' as NodeState } }) },
    { delay: 400, sidePanel: sidePanels.report, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-report': 'active' as EdgeState, 'cre-ipfs': 'active' as EdgeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-report': 'completed' as EdgeState, 'cre-ipfs': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, forwarder: 'active' as NodeState, ipfs: 'active' as NodeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, forwarder: 'completed' as NodeState, ipfs: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'forwarder-report': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'forwarder-report': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, report: 'active' as NodeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'report-protocol': 'active' as EdgeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'report-protocol': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, protocol: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, cre: 'completed' as NodeState, teeContainer: 'completed' as NodeState, protocol: 'completed' as NodeState } }) },
  ]
}

export default function TradeFlowDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState
  const { editMode } = useLayoutEditor()

  useEffect(() => { registerSequence('trade', buildTradeSequence()) }, [registerSequence])

  const nodes: Node[] = useMemo(() => [
    // --- CRE / TEE container ---
    { id: 'teeContainer', type: 'creEnclaveNode', position: { x: 300, y: 0 },
      style: { zIndex: -1, width: 530, height: 420 },
      data: { label: 'CRE', state: nodeStates.teeContainer || 'idle' },
      draggable: false, selectable: false },

    // --- Arc container ---
    { id: 'arcContainer', type: 'chainNode', position: { x: 10, y: 330 },
      style: { zIndex: -1, width: 280, height: 240 },
      data: { chainName: 'Arc (Circle)', brandColor: '#06b6d4', showHeader: true, state: 'idle' as NodeState },
      draggable: false, selectable: false },

    // --- User ---
    { id: 'user', type: 'actorNode', position: { x: 10, y: 120 },
      data: { label: 'User', role: 'user', state: nodeStates.user || 'idle' },
      draggable: false, selectable: false },

    // --- On-chain (Arc) ---
    { id: 'swap', type: 'contractNode', position: { x: 140, y: 100 },
      data: { label: 'EscrowSwap', description: 'emit ComplianceCheckRequested', state: nodeStates.swap || 'idle' },
      draggable: false, selectable: false },
    { id: 'forwarder', type: 'contractNode', position: { x: 30, y: 300 },
      data: { label: 'KeystoneForwarder', description: 'verifies DON signature', state: nodeStates.forwarder || 'idle' },
      draggable: false, selectable: false },
    { id: 'report', type: 'contractNode', position: { x: 30, y: 370 },
      data: { label: 'ComplianceReportConsumer', description: 'approves/rejects', state: nodeStates.report || 'idle', complianceResult: 'approved' },
      draggable: false, selectable: false },
    { id: 'protocol', type: 'contractNode', position: { x: 30, y: 490 },
      data: { label: 'Swap Protocol', description: 'onComplianceApproved(tradeId)', state: nodeStates.protocol || 'idle', complianceResult: 'approved' },
      draggable: false, selectable: false },

    // --- Inside TEE ---
    { id: 'cre', type: 'workflowNode', position: { x: 330, y: 60 },
      data: { label: 'Workflow B', description: 'Per-Trade Compliance', state: nodeStates.cre || 'idle', checks: ['Sumsub KYC + sanctions + PEP', 'Chainalysis (trader)', 'Chainalysis (counterparty)', 'Jurisdiction rules', 'Structuring detection', 'Aggregate decision'] },
      draggable: false, selectable: false },
    { id: 'sumsub', type: 'providerNode', position: { x: 610, y: 30 },
      data: { label: 'Sumsub', provider: 'sumsub', state: nodeStates.sumsub || 'idle' },
      draggable: false, selectable: false },
    { id: 'chTrader', type: 'providerNode', position: { x: 610, y: 140 },
      data: { label: 'Chainalysis', provider: 'chainalysis', purpose: 'Trader wallet risk', state: nodeStates.chTrader || 'idle' },
      draggable: false, selectable: false },
    { id: 'chCounter', type: 'providerNode', position: { x: 610, y: 250 },
      data: { label: 'Chainalysis', provider: 'chainalysis', purpose: 'Counterparty risk', state: nodeStates.chCounter || 'idle' },
      draggable: false, selectable: false },
    { id: 'rules', type: 'ruleEngineNode', position: { x: 580, y: 360 },
      data: { label: 'Rules Engine', state: nodeStates.rules || 'idle', rules: ['MiCA: DE → allowed', 'Asset: USDC → eligible', 'Threshold: below limit', 'Structuring: none'] },
      draggable: false, selectable: false },

    // --- IPFS ---
    { id: 'ipfs', type: 'ipfsNode', position: { x: 550, y: 500 },
      data: { label: 'IPFS / Pinata', state: nodeStates.ipfs || 'idle', cid: 'QmXyz...audit' },
      draggable: false, selectable: false },
  ], [nodeStates])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'trade')

  const edges: Edge[] = useMemo(() => [
    { id: 'user-swap', source: 'user', target: 'swap', type: 'dataFlowEdge', data: { state: edgeStates['user-swap'] || 'idle', label: 'swap()' } },
    { id: 'swap-cre', source: 'swap', target: 'cre', type: 'onChainEdge', data: { state: edgeStates['swap-cre'] || 'idle', label: 'EVM Log' } },
    { id: 'cre-sumsub', source: 'cre', target: 'sumsub', type: 'confidentialEdge', data: { state: edgeStates['cre-sumsub'] || 'idle', label: 'Confidential HTTP (TEE)' } },
    { id: 'cre-ch-trader', source: 'cre', target: 'chTrader', type: 'confidentialEdge', data: { state: edgeStates['cre-ch-trader'] || 'idle', label: 'Confidential HTTP (TEE)' } },
    { id: 'cre-ch-counter', source: 'cre', target: 'chCounter', type: 'confidentialEdge', data: { state: edgeStates['cre-ch-counter'] || 'idle', label: 'Confidential HTTP (TEE)' } },
    { id: 'cre-rules', source: 'cre', target: 'rules', type: 'dataFlowEdge', data: { state: edgeStates['cre-rules'] || 'idle' } },
    { id: 'cre-report', source: 'cre', sourceHandle: 'bottom', target: 'forwarder', targetHandle: 'top', type: 'onChainEdge', data: { state: edgeStates['cre-report'] || 'idle', label: 'writeReport()' } },
    { id: 'forwarder-report', source: 'forwarder', sourceHandle: 'bottom', target: 'report', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['forwarder-report'] || 'idle', label: 'onReport()' } },
    { id: 'cre-ipfs', source: 'cre', sourceHandle: 'bottom', target: 'ipfs', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['cre-ipfs'] || 'idle', label: 'AuditRecord' } },
    { id: 'report-protocol', source: 'report', sourceHandle: 'bottom', target: 'protocol', targetHandle: 'top', type: 'callbackEdge', data: { state: edgeStates['report-protocol'] || 'idle', label: 'onComplianceApproved(tradeId)' } },
  ], [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'trade')

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow nodes={editableNodes} edges={editableEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onReconnect={onReconnect} onNodeDoubleClick={onNodeDoubleClick} onEdgeDoubleClick={onEdgeDoubleClick} edgesReconnectable={editMode} deleteKeyCode={editMode ? 'Backspace' : null} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={editMode} nodesConnectable={editMode} panOnDrag={!editMode} zoomOnScroll={editMode} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} fitView fitViewOptions={{ padding: 0.06 }} proOptions={{ hideAttribution: true }} className="bg-surface-900">
          <AutoFitView trigger={nodeStates} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
