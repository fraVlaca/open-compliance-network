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
  user: {
    stage: 'KYC Flow', beat: 'User Onboarding', title: 'Sumsub SDK',
    json: { 'Step': 'User completes KYC in Sumsub Web SDK widget', 'Actions': ['Upload identity document', 'Take selfie for face match', 'Automated verification by Sumsub'], 'Result': 'Sumsub returns applicantId to frontend', 'User experience': 'Standard KYC flow — same as any fintech app' },
    highlightFields: ['Result'],
  },
  tee: {
    stage: 'KYC Flow', beat: 'Confidential Verification', title: 'CRE Workflow A (TEE)',
    json: {
      'Trigger': 'Broker frontend signs HTTP request with wallet',
      'IntegratorRegistry': 'On-chain lookup: wallet → {appId, workspace, role}',
      'Inside TEE': ['Read IntegratorRegistry — get broker appId + workspace', 'Confidential HTTP → Sumsub: verify applicant status', 'Confidential HTTP → Chainalysis: wallet risk score', 'Build credential with brokerAppId in data'],
      'Sumsub namespace': 'externalUserId = "proto_abc:broker_xyz:0xWallet"',
      'Multi-tenancy': 'One Sumsub account. Scoping via namespaced externalUserId. No manual setup per integrator.',
    },
    highlightFields: ['Inside TEE', 'Sumsub namespace'],
  },
  credential: {
    stage: 'KYC Flow', beat: 'Credential Issuance', title: 'On-Chain Credential',
    json: {
      'writeReport()': 'DON-signed report → KeystoneForwarder → Consumer',
      'Consumer calls': ['IdentityRegistry.registerIdentity(ccid, wallet)', 'CredentialRegistry.registerCredential(ccid, KYC_VERIFIED, ...)'],
      'Credential data': { kycLevel: 2, riskScore: 1, jurisdiction: 'DE', brokerAppId: '0xbroker_xyz...', workspaceId: '0xproto_abc...' },
      'Now any protocol': 'require(consumer.isVerified(wallet)) — 1 line',
    },
    highlightFields: ['Consumer calls', 'Now any protocol', 'Credential data'],
  },
}

function buildKycSequence(): StageSequence {
  return [
    { delay: 300, sidePanel: sidePanels.user, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, user: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, user: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'user-broker': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'user-broker': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, broker: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, broker: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'broker-cre': 'active' as EdgeState } }) },
    { delay: 500, sidePanel: sidePanels.tee, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'broker-cre': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, cre: 'active' as NodeState, teeContainer: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-sumsub': 'active' as EdgeState, 'cre-chainalysis': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'active' as NodeState, chainalysis: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'completed' as NodeState, chainalysis: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'cre-sumsub': 'completed' as EdgeState, 'cre-chainalysis': 'completed' as EdgeState } }) },
    { delay: 600, sidePanel: sidePanels.credential, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-consumer': 'active' as EdgeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'cre-consumer': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, consumer: 'active' as NodeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'consumer-identity': 'active' as EdgeState, 'consumer-credential': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({
      nodeStates: { ...s.nodeStates, cre: 'completed' as NodeState, teeContainer: 'completed' as NodeState, consumer: 'completed' as NodeState, identityReg: 'completed' as NodeState, credentialReg: 'completed' as NodeState },
      edgeStates: { ...s.edgeStates, 'consumer-identity': 'completed' as EdgeState, 'consumer-credential': 'completed' as EdgeState },
    }) },
  ]
}

export default function KycFlowDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState
  const { editMode } = useLayoutEditor()

  useEffect(() => { registerSequence('kyc', buildKycSequence()) }, [registerSequence])

  const nodes: Node[] = useMemo(() => [
    // --- CRE / TEE container ---
    { id: 'teeContainer', type: 'creEnclaveNode', position: { x: 290, y: 10 },
      style: { zIndex: -1, width: 500, height: 280 },
      data: { label: 'CRE / TEE Enclave — Workflow A', state: nodeStates.teeContainer || 'idle' },
      draggable: false, selectable: false },

    // --- Arc container ---
    { id: 'arcContainer', type: 'chainNode', position: { x: 200, y: 330 },
      style: { zIndex: -1, width: 440, height: 200 },
      data: { chainName: 'Arc (Circle)', brandColor: '#06b6d4', showHeader: true, state: 'idle' as NodeState },
      draggable: false, selectable: false },

    // --- Actors (outside) ---
    { id: 'user', type: 'actorNode', position: { x: 10, y: 100 },
      data: { label: 'User', role: 'user', state: nodeStates.user || 'idle' },
      draggable: false, selectable: false },
    { id: 'broker', type: 'actorNode', position: { x: 150, y: 100 },
      data: { label: 'Broker Frontend', role: 'frontend', state: nodeStates.broker || 'idle' },
      draggable: false, selectable: false },

    // --- Inside TEE ---
    { id: 'cre', type: 'workflowNode', position: { x: 320, y: 60 },
      data: { label: 'Workflow A', description: 'Identity Verification', state: nodeStates.cre || 'idle', checks: ['Read IntegratorRegistry', 'Sumsub: verify KYC', 'Chainalysis: wallet risk', 'Build credential'] },
      draggable: false, selectable: false },
    { id: 'sumsub', type: 'providerNode', position: { x: 580, y: 40 },
      data: { label: 'Sumsub', provider: 'sumsub', state: nodeStates.sumsub || 'idle' },
      draggable: false, selectable: false },
    { id: 'chainalysis', type: 'providerNode', position: { x: 580, y: 180 },
      data: { label: 'Chainalysis', provider: 'chainalysis', state: nodeStates.chainalysis || 'idle' },
      draggable: false, selectable: false },

    // --- Inside Arc ---
    { id: 'consumer', type: 'contractNode', position: { x: 230, y: 370 },
      data: { label: 'CredentialConsumer', description: 'onReport() → registries', state: nodeStates.consumer || 'idle' },
      draggable: false, selectable: false },
    { id: 'identityReg', type: 'registryNode', position: { x: 230, y: 470 },
      data: { label: 'IdentityRegistry', state: nodeStates.identityReg || 'idle' },
      draggable: false, selectable: false },
    { id: 'credentialReg', type: 'registryNode', position: { x: 450, y: 470 },
      data: { label: 'CredentialRegistry', state: nodeStates.credentialReg || 'idle' },
      draggable: false, selectable: false },
  ], [nodeStates])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'kyc')

  const edges: Edge[] = useMemo(() => [
    { id: 'user-broker', source: 'user', target: 'broker', type: 'dataFlowEdge', data: { state: edgeStates['user-broker'] || 'idle', label: 'Sumsub SDK' } },
    { id: 'broker-cre', source: 'broker', target: 'cre', type: 'dataFlowEdge', data: { state: edgeStates['broker-cre'] || 'idle', label: 'HTTP trigger' } },
    { id: 'cre-sumsub', source: 'cre', target: 'sumsub', type: 'confidentialEdge', data: { state: edgeStates['cre-sumsub'] || 'idle' } },
    { id: 'cre-chainalysis', source: 'cre', target: 'chainalysis', type: 'confidentialEdge', data: { state: edgeStates['cre-chainalysis'] || 'idle' } },
    { id: 'cre-consumer', source: 'cre', sourceHandle: 'bottom', target: 'consumer', targetHandle: 'top', type: 'onChainEdge', data: { state: edgeStates['cre-consumer'] || 'idle', label: 'writeReport()' } },
    { id: 'consumer-identity', source: 'consumer', sourceHandle: 'bottom', target: 'identityReg', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['consumer-identity'] || 'idle' } },
    { id: 'consumer-credential', source: 'consumer', sourceHandle: 'bottom', target: 'credentialReg', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['consumer-credential'] || 'idle' } },
  ], [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'kyc')

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow nodes={editableNodes} edges={editableEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onReconnect={onReconnect} onNodeDoubleClick={onNodeDoubleClick} onEdgeDoubleClick={onEdgeDoubleClick} edgesReconnectable={editMode} deleteKeyCode={editMode ? 'Backspace' : null} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={editMode} nodesConnectable={editMode} panOnDrag={!editMode} zoomOnScroll={editMode} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} fitView fitViewOptions={{ padding: 0.08 }} proOptions={{ hideAttribution: true }} className="bg-surface-900">
          <AutoFitView trigger={nodeStates} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
