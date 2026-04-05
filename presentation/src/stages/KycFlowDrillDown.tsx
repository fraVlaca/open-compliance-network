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

// ── Side panels ──────────────────────────────────────────────────────

const sidePanels: Record<string, SidePanelData> = {
  token: {
    stage: 'KYC Flow', beat: 'Step 1 - Token Generation', title: 'Workflow D - Create Applicant',
    json: {
      'User action': 'Clicks "Get Verified" in frontend (@ocn/react)',
      'Frontend calls': 'POST /api/kyc/token on Backend SDK (@ocn/node-sdk)',
      'Backend SDK triggers': 'CRE Workflow D (HTTP trigger)',
      'Inside CRE': [
        'Read IntegratorRegistry - verify integrator is active',
        'Create Sumsub applicant with namespaced externalUserId',
        'externalUserId = {workspaceId}:{brokerAppId}:{walletAddress}',
        'Confidential HTTP (TEE) → Sumsub: create applicant + generate access token',
        'Return short-lived access token to frontend',
      ],
      'Result': 'Frontend receives token, renders Sumsub iframe',
    },
    highlightFields: ['Inside CRE', 'Result'],
  },
  verification: {
    stage: 'KYC Flow', beat: 'Step 2 - Identity Verification', title: 'Workflow A - Verify + Credential',
    json: {
      'User action': 'Completes KYC in Sumsub iframe (documents, selfie)',
      'Sumsub SDK fires': 'onApplicantSubmitted → frontend calls POST /api/kyc/verify',
      'Backend SDK triggers': 'CRE Workflow A (HTTP trigger)',
      'Inside CRE': [
        'Confidential HTTP (TEE) → Sumsub: pull applicant status, KYC level, sanctions, PEP',
        'If verified: Confidential HTTP (TEE) → Chainalysis: wallet risk score',
        'Build CCID: keccak256(abi.encodePacked("compliance-v1", walletAddress))',
        'Build credential: KYC level, risk score, jurisdiction, expiration, brokerAppId',
        'writeReport() → KeystoneForwarder → ComplianceCredentialConsumer.onReport()',
      ],
      'DON consensus': 'Report threshold-signed by 21 Chainlink nodes before delivery',
    },
    highlightFields: ['Inside CRE', 'DON consensus'],
  },
  credential: {
    stage: 'KYC Flow', beat: 'Credential Issuance', title: 'On-Chain Credential',
    json: {
      'ComplianceCredentialConsumer': 'Receives DON-signed report via onReport()',
      'Consumer calls': ['IdentityRegistry.registerIdentity(ccid, wallet)', 'CredentialRegistry.registerCredential(ccid, KYC_VERIFIED, ...)'],
      'Credential data': { kycLevel: 2, riskScore: 1, jurisdiction: 'DE', brokerAppId: '0xbroker_xyz...', workspaceId: '0xproto_abc...' },
      'Frontend polls': 'isVerified(wallet) on-chain → verified!',
      'Now any protocol': 'require(consumer.isVerified(wallet)) - 1 line',
    },
    highlightFields: ['Consumer calls', 'Frontend polls', 'Now any protocol'],
  },
}

// ── Sequence ─────────────────────────────────────────────────────────

function buildKycSequence(): StageSequence {
  return [
    // ═══ PHASE 1: Token Generation (Workflow D) ═══
    { delay: 300, sidePanel: sidePanels.token, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, user: 'active' as NodeState } }) },
    // User → Frontend
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, user: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'user-frontend': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'user-frontend': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, frontend: 'active' as NodeState } }) },
    // Frontend → Backend SDK
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, frontend: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'frontend-backend': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'frontend-backend': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, backend: 'active' as NodeState } }) },
    // Backend → Workflow D
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, backend: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'backend-wfD': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'backend-wfD': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, wfD: 'active' as NodeState, teeContainer: 'active' as NodeState } }) },
    // Workflow D reads IntegratorRegistry
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfD-integratorReg': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfD-integratorReg': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, integratorReg: 'active' as NodeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, integratorReg: 'completed' as NodeState } }) },
    // Workflow D ↔ Sumsub (RoundTrip - create applicant + get token)
    { delay: 300, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfD-sumsub': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfD-sumsub': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, sumsub: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'sumsub-wfD-return': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'sumsub-wfD-return': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, wfD: 'completed' as NodeState } }) },
    // Token flows back → Frontend renders iframe
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'frontend-iframe': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'frontend-iframe': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, iframe: 'active' as NodeState } }) },

    // ═══ PHASE 2: Identity Verification (Workflow A) ═══
    // User completes KYC in iframe
    { delay: 800, sidePanel: sidePanels.verification, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, iframe: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'iframe-frontend': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'iframe-frontend': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, frontend: 'active' as NodeState } }) },
    // Frontend → Backend (verify)
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'frontend-backend-verify': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'frontend-backend-verify': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, backend: 'active' as NodeState } }) },
    // Backend → Workflow A
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'backend-wfA': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'backend-wfA': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, wfA: 'active' as NodeState } }) },
    // Workflow A → Sumsub + Chainalysis (parallel confidential calls)
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfA-sumsub': 'active' as EdgeState, 'wfA-chainalysis': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'active' as NodeState, chainalysis: 'active' as NodeState } }) },
    { delay: 700, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsub: 'completed' as NodeState, chainalysis: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'wfA-sumsub': 'completed' as EdgeState, 'wfA-chainalysis': 'completed' as EdgeState } }) },
    // writeReport → KeystoneForwarder → Consumer → Registries
    { delay: 500, sidePanel: sidePanels.credential, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfA-forwarder': 'active' as EdgeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfA-forwarder': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, forwarder: 'active' as NodeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, forwarder: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'forwarder-consumer': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'forwarder-consumer': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, consumer: 'active' as NodeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'consumer-identity': 'active' as EdgeState, 'consumer-credential': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({
      nodeStates: { ...s.nodeStates, wfA: 'completed' as NodeState, teeContainer: 'completed' as NodeState, consumer: 'completed' as NodeState, identityReg: 'completed' as NodeState, credentialReg: 'completed' as NodeState, frontend: 'completed' as NodeState, backend: 'completed' as NodeState },
      edgeStates: { ...s.edgeStates, 'consumer-identity': 'completed' as EdgeState, 'consumer-credential': 'completed' as EdgeState },
    }) },
  ]
}

// ── Component ────────────────────────────────────────────────────────

export default function KycFlowDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState
  const { editMode } = useLayoutEditor()

  useEffect(() => { registerSequence('kyc', buildKycSequence()) }, [registerSequence])

  const nodes: Node[] = useMemo(() => [
    // --- CRE container (holds both Workflow D & A) ---
    { id: 'teeContainer', type: 'creEnclaveNode', position: { x: 340, y: 10 },
      style: { zIndex: -1, width: 560, height: 320 },
      data: { label: 'CRE', state: nodeStates.teeContainer || 'idle' },
      draggable: false, selectable: false },

    // --- Arc container ---
    { id: 'arcContainer', type: 'chainNode', position: { x: 250, y: 370 },
      style: { zIndex: -1, width: 440, height: 200 },
      data: { chainName: 'Arc (Circle)', brandColor: '#06b6d4', showHeader: true, state: 'idle' as NodeState },
      draggable: false, selectable: false },

    // --- External actors ---
    { id: 'user', type: 'actorNode', position: { x: 10, y: 60 },
      data: { label: 'User', role: 'user', state: nodeStates.user || 'idle' },
      draggable: false, selectable: false },
    { id: 'frontend', type: 'actorNode', position: { x: 10, y: 180 },
      data: { label: 'Frontend', role: 'frontend', state: nodeStates.frontend || 'idle' },
      draggable: false, selectable: false },
    { id: 'backend', type: 'actorNode', position: { x: 180, y: 120 },
      data: { label: 'Backend SDK', role: 'backend', state: nodeStates.backend || 'idle' },
      draggable: false, selectable: false },

    // --- Sumsub iframe ---
    { id: 'iframe', type: 'actorNode', position: { x: 10, y: 310 },
      data: { label: 'Sumsub Iframe', role: 'frontend', state: nodeStates.iframe || 'idle' },
      draggable: false, selectable: false },

    // --- Inside CRE ---
    { id: 'wfD', type: 'workflowNode', position: { x: 370, y: 50 },
      data: { label: 'Workflow D', description: 'Token Generation', state: nodeStates.wfD || 'idle',
        checks: ['Read IntegratorRegistry', 'Create Sumsub applicant', 'Generate access token'] },
      draggable: false, selectable: false },
    { id: 'wfA', type: 'workflowNode', position: { x: 370, y: 190 },
      data: { label: 'Workflow A', description: 'Identity Verification', state: nodeStates.wfA || 'idle',
        checks: ['Sumsub: status + KYC + sanctions + PEP', 'Chainalysis: wallet risk', 'Build CCID + credential', 'writeReport()'] },
      draggable: false, selectable: false },

    // --- Providers ---
    { id: 'sumsub', type: 'providerNode', position: { x: 680, y: 40 },
      data: { label: 'Sumsub', provider: 'sumsub', state: nodeStates.sumsub || 'idle' },
      draggable: false, selectable: false },
    { id: 'chainalysis', type: 'providerNode', position: { x: 680, y: 220 },
      data: { label: 'Chainalysis', provider: 'chainalysis', state: nodeStates.chainalysis || 'idle' },
      draggable: false, selectable: false },

    // --- Inside Arc ---
    { id: 'forwarder', type: 'contractNode', position: { x: 280, y: 400 },
      data: { label: 'KeystoneForwarder', description: 'verifies DON signature', state: nodeStates.forwarder || 'idle' },
      draggable: false, selectable: false },
    { id: 'consumer', type: 'contractNode', position: { x: 480, y: 400 },
      data: { label: 'ComplianceCredentialConsumer', description: 'onReport() → registries', state: nodeStates.consumer || 'idle' },
      draggable: false, selectable: false },
    { id: 'identityReg', type: 'registryNode', position: { x: 280, y: 510 },
      data: { label: 'IdentityRegistry', state: nodeStates.identityReg || 'idle' },
      draggable: false, selectable: false },
    { id: 'credentialReg', type: 'registryNode', position: { x: 500, y: 510 },
      data: { label: 'CredentialRegistry', state: nodeStates.credentialReg || 'idle' },
      draggable: false, selectable: false },
    { id: 'integratorReg', type: 'registryNode', position: { x: 500, y: 410 },
      data: { label: 'IntegratorRegistry', state: nodeStates.integratorReg || 'idle' },
      draggable: false, selectable: false },
  ], [nodeStates])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'kyc')

  const edges: Edge[] = useMemo(() => [
    // ═══ PHASE 1: Token Generation ═══
    { id: 'user-frontend', source: 'user', target: 'frontend', type: 'dataFlowEdge', data: { state: edgeStates['user-frontend'] || 'idle', label: '"Get Verified"' } },
    { id: 'frontend-backend', source: 'frontend', target: 'backend', type: 'dataFlowEdge', data: { state: edgeStates['frontend-backend'] || 'idle', label: 'POST /api/kyc/token' } },
    { id: 'backend-wfD', source: 'backend', target: 'wfD', type: 'dataFlowEdge', data: { state: edgeStates['backend-wfD'] || 'idle', label: 'HTTP trigger' } },
    { id: 'wfD-integratorReg', source: 'wfD', sourceHandle: 'bottom', target: 'integratorReg', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['wfD-integratorReg'] || 'idle' } },
    { id: 'wfD-sumsub', source: 'wfD', target: 'sumsub', type: 'roundTripEdge',
      data: { requestState: edgeStates['wfD-sumsub'] || 'idle', responseState: edgeStates['sumsub-wfD-return'] || 'idle',
        requestLabel: 'Confidential HTTP (TEE)', responseLabel: 'access token', variant: 'confidential' } },
    { id: 'frontend-iframe', source: 'frontend', sourceHandle: 'bottom', target: 'iframe', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['frontend-iframe'] || 'idle', label: 'render iframe' } },

    // ═══ PHASE 2: Identity Verification ═══
    { id: 'iframe-frontend', source: 'iframe', target: 'frontend', type: 'callbackEdge', data: { state: edgeStates['iframe-frontend'] || 'idle', label: 'onApplicantSubmitted' } },
    { id: 'frontend-backend-verify', source: 'frontend', target: 'backend', type: 'dataFlowEdge', data: { state: edgeStates['frontend-backend-verify'] || 'idle', label: 'POST /api/kyc/verify' } },
    { id: 'backend-wfA', source: 'backend', target: 'wfA', type: 'dataFlowEdge', data: { state: edgeStates['backend-wfA'] || 'idle', label: 'HTTP trigger' } },
    { id: 'wfA-sumsub', source: 'wfA', target: 'sumsub', type: 'confidentialEdge', data: { state: edgeStates['wfA-sumsub'] || 'idle', label: 'Confidential HTTP (TEE)' } },
    { id: 'wfA-chainalysis', source: 'wfA', target: 'chainalysis', type: 'confidentialEdge', data: { state: edgeStates['wfA-chainalysis'] || 'idle', label: 'Confidential HTTP (TEE)' } },
    { id: 'wfA-forwarder', source: 'wfA', sourceHandle: 'bottom', target: 'forwarder', targetHandle: 'top', type: 'onChainEdge', data: { state: edgeStates['wfA-forwarder'] || 'idle', label: 'writeReport()' } },
    { id: 'forwarder-consumer', source: 'forwarder', sourceHandle: 'bottom', target: 'consumer', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['forwarder-consumer'] || 'idle', label: 'onReport()' } },
    { id: 'consumer-identity', source: 'consumer', sourceHandle: 'bottom', target: 'identityReg', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['consumer-identity'] || 'idle' } },
    { id: 'consumer-credential', source: 'consumer', sourceHandle: 'bottom', target: 'credentialReg', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['consumer-credential'] || 'idle' } },
  ], [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'kyc')

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
