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
import type { StageSequence, FlowState, NodeState, SidePanelData } from '../types'
import { DEMO } from '../constants'

const sidePanels: Record<string, SidePanelData> = {
  pattern1: {
    stage: 'Integration', beat: 'Pattern 1', title: 'Simplest — 1 Line of Solidity',
    json: {
      'Code': 'require(consumer.isVerified(msg.sender), "Not compliant")',
      'How it works': 'Reads on-chain credential synchronously — like reading a Chainlink price feed',
      'Best for': 'Any protocol that needs KYC gating. No ACE framework needed.',
      'Credential source': 'Written by CRE Workflow A → ACE CredentialRegistry',
      'Gas cost': 'One SLOAD — minimal, same tx',
      'Any protocol on Arc': 'Can integrate compliance with this single line. No KYC backend, no Sumsub account, no compliance team.',
    },
    highlightFields: ['Code', 'Any protocol on Arc'],
  },
  pattern2: {
    stage: 'Integration', beat: 'Pattern 2', title: 'ACE PolicyEngine',
    json: {
      'Code': 'function trade(...) external runPolicy { ... }',
      'How it works': 'ACE PolicyEngine runs CredentialRegistryIdentityValidatorPolicy transparently in the modifier',
      'Best for': 'Protocols already using Chainlink ACE framework',
      'Setup': 'One-time: addPolicy(protocol, selector, credentialPolicy)',
      'Benefit': 'Validates BOTH trader AND counterparty credentials automatically',
      'Modular': 'Add multiple policies (volume limits, role-based access, compliance) to the same function',
    },
    highlightFields: ['Code', 'Benefit'],
  },
  pattern3: {
    stage: 'Integration', beat: 'Pattern 3', title: 'Async + Auto-Callback',
    json: {
      'Code': 'emit ComplianceCheckRequested(tradeId, ...)',
      'Flow': 'swap() → emit event → CRE picks up → all checks in TEE → DON consensus → writeReport → onComplianceApproved(tradeId) → trade executes',
      'Best for': 'Deep per-trade checks: sanctions + counterparty risk + jurisdiction + structuring',
      'User experience': 'ONE transaction. CRE auto-callbacks execute the trade.',
      'Deployed': `EscrowSwap on Arc Testnet: ${DEMO.contracts.escrowSwap}`,
      'Cross-chain ready': 'Credentials use ACE CCIDs — portable across EVM chains via CCIP',
    },
    highlightFields: ['User experience', 'Cross-chain ready', 'Flow'],
  },
}

function buildIntegrationSequence(): StageSequence {
  return [
    { delay: 300, sidePanel: sidePanels.pattern1, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, code1: 'active' as NodeState } }) },
    { delay: 2000, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, code1: 'completed' as NodeState } }) },
    { delay: 400, sidePanel: sidePanels.pattern2, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, code2: 'active' as NodeState } }) },
    { delay: 2000, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, code2: 'completed' as NodeState } }) },
    { delay: 400, sidePanel: sidePanels.pattern3, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, code3: 'active' as NodeState } }) },
    { delay: 2000, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, code3: 'completed' as NodeState } }) },
  ]
}

export default function IntegrationDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates } = state.flowState
  const { editMode } = useLayoutEditor()

  useEffect(() => { registerSequence('integration', buildIntegrationSequence()) }, [registerSequence])

  const nodes: Node[] = useMemo(() => [
    { id: 'code1', type: 'codeNode', position: { x: 30, y: 30 }, data: {
      title: 'Pattern 1: Simplest (1 line)', language: 'Solidity',
      code: DEMO.integration.pattern1,
      state: nodeStates.code1 || 'idle',
    }, draggable: false, selectable: false },
    { id: 'code2', type: 'codeNode', position: { x: 30, y: 220 }, data: {
      title: 'Pattern 2: ACE PolicyEngine', language: 'Solidity',
      code: DEMO.integration.pattern2,
      state: nodeStates.code2 || 'idle',
    }, draggable: false, selectable: false },
    { id: 'code3', type: 'codeNode', position: { x: 30, y: 380 }, data: {
      title: 'Pattern 3: Async + Auto-Callback', language: 'Solidity',
      code: DEMO.integration.pattern3,
      state: nodeStates.code3 || 'idle',
    }, draggable: false, selectable: false },
  ], [nodeStates])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'integration')
  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges([], 'integration')

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
