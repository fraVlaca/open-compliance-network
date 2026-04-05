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
  workflowC: {
    stage: 'Audit', beat: 'Workflow C - Identity Audit', title: 'KYC/AML Data Access',
    json: {
      'Trigger': 'Integrator signs HTTP request with wallet',
      'Inside CRE': {
        '1. Read IntegratorRegistry': 'Get appId, workspace, role from on-chain',
        '2. Read CredentialRegistry + check scoping': 'Does this user belong to requester\'s scope?',
        '3. Confidential HTTP (TEE) → Sumsub': 'Fetch via namespaced externalUserId',
        '4. Encrypt response (AES-GCM)': 'AES-GCM encrypted to integrator\'s public key',
      },
      'Scoping rules': { 'Protocol (PROTOCOL)': 'All users in workspace', 'Broker (BROKER)': 'Only users they onboarded (brokerAppId)', 'LP': 'Only users in their trades (lpAppId)' },
      'PII never stored': 'Fetched from Sumsub on-demand. Lives in CRE for milliseconds. Returns encrypted.',
    },
    highlightFields: ['Inside CRE', 'Scoping rules', 'PII never stored'],
  },
  readReport: {
    stage: 'Audit', beat: 'Step 1 - Read Report', title: 'On-Chain Compliance Report',
    json: {
      'Call': 'ComplianceReportConsumer.getReport(tradeId)',
      'Returns': {
        approved: true,
        riskScore: 2,
        workflowId: '0x7a3b...  ← hash of the workflow binary',
        auditHash: '0x9f2e...   ← keccak256 of full AuditRecord',
        ipfsCid: 'QmXyz...      ← IPFS content identifier',
        timestamp: 1743696000,
      },
      'DON-signed': 'This report was threshold-signed by 21 Chainlink nodes',
      'Immutable': 'Cannot be altered. On-chain forever.',
    },
    highlightFields: ['Returns', 'DON-signed'],
  },
  verifyCode: {
    stage: 'Audit', beat: 'Step 2 - Verify Code', title: 'Was This the Right Code?',
    json: {
      '1. Fetch source': 'Clone the open-source workflow from GitHub',
      '2. Compile locally': 'cre workflow build → produces WASM binary',
      '3. Hash the binary': 'keccak256(binary + config) → local hash',
      '4. Compare': 'localHash === report.workflowId?',
      '✓ Match': 'This EXACT code produced the compliance decision. If even one line was different, the hash would not match.',
      'Self-binding': 'The operator cannot change the code without the workflowId changing - visible to everyone.',
    },
    highlightFields: ['4. Compare', '✓ Match', 'Self-binding'],
  },
  verifyAudit: {
    stage: 'Audit', beat: 'Step 3 - Verify Audit', title: 'Is the Evidence Real?',
    json: {
      '1. Extract ipfsCid': 'From the on-chain report',
      '2. Fetch from IPFS': 'GET https://gateway.pinata.cloud/ipfs/{cid}',
      '3. Get full AuditRecord': 'All provider responses, jurisdiction rules, risk scores - point-in-time snapshot',
      '4. Hash the record': 'keccak256(JSON.stringify(auditRecord))',
      '5. Compare': 'computedHash === report.auditHash?',
      '✓ Match': 'The evidence is exactly what the DON produced at trade time. Content-addressed + hash-verified = triple tamper-proof.',
      'Three guarantees': 'DON consensus (nodes agreed) + on-chain immutability (can\'t alter) + IPFS content addressing (CID IS the hash)',
    },
    highlightFields: ['5. Compare', '✓ Match', 'Three guarantees'],
  },
  selfBinding: {
    stage: 'Audit', beat: 'Trust Model', title: 'Self-Binding Architecture',
    json: {
      'What we proved': {
        'Code': 'workflowId matches open-source → this exact code ran',
        'Decision': 'On-chain report is DON-signed → 21 nodes agreed',
        'Evidence': 'auditHash matches IPFS record → data is untampered',
      },
      'Self-binding': 'Open code + pinned workflowId + DON consensus = operator CANNOT cheat',
      'Centralized alt': 'Trust one server. Could selectively approve. No proof otherwise.',
      'DECO (future)': 'ZK proof of TLS session - mathematical proof Sumsub returned "verified"',
    },
    highlightFields: ['What we proved', 'Self-binding'],
  },
}

// ── Sequence ─────────────────────────────────────────────────────────

function buildAuditSequence(): StageSequence {
  return [
    // ═══ LEFT: Workflow C - KYC/AML data access ═══
    { delay: 300, sidePanel: sidePanels.workflowC, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, integrator: 'active' as NodeState } }) },
    // Integrator → CRE
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, integrator: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'integrator-wfC': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'integrator-wfC': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, wfC: 'active' as NodeState, teeLeft: 'active' as NodeState } }) },
    // CRE reads IntegratorRegistry + CredentialRegistry on Arc
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-registry': 'active' as EdgeState, 'wfC-credentialReg': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-registry': 'completed' as EdgeState, 'wfC-credentialReg': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, registryCheck: 'active' as NodeState, credentialCheck: 'active' as NodeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, registryCheck: 'completed' as NodeState, credentialCheck: 'completed' as NodeState } }) },
    // CRE calls Sumsub (RoundTripEdge - request path)
    { delay: 300, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-sumsub': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-sumsub': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, sumsubFetch: 'active' as NodeState } }) },
    // Sumsub returns KYC data (RoundTripEdge - response path)
    { delay: 700, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsubFetch: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'sumsub-wfC-return': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'sumsub-wfC-return': 'completed' as EdgeState } }) },
    // CRE encrypts → sends back to integrator (RoundTripEdge - response path)
    { delay: 300, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-integrator-return': 'active' as EdgeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-integrator-return': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, wfC: 'completed' as NodeState, teeLeft: 'completed' as NodeState, integrator: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, integrator: 'completed' as NodeState } }) },

    // ═══ RIGHT: Audit trail reconciliation ═══
    // LP backend starts verification
    { delay: 600, sidePanel: sidePanels.readReport, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, lpBackend: 'active' as NodeState } }) },
    // Step 1: Read on-chain report (RoundTripEdge - request path)
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'lp-arcReport': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'lp-arcReport': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, arcReport: 'active' as NodeState } }) },
    // Report returns data (RoundTripEdge - response path)
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, arcReport: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'arcReport-lp-return': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'arcReport-lp-return': 'completed' as EdgeState } }) },

    // Step 2: Verify workflow code (forward chain: LP → GitHub → verifyWfId)
    { delay: 400, sidePanel: sidePanels.verifyCode, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'lp-github': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'lp-github': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, github: 'active' as NodeState } }) },
    // Source code flows down to verification
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, github: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'github-verify': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'github-verify': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, verifyWfId: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, verifyWfId: 'completed' as NodeState } }) },

    // Step 3: Fetch IPFS + verify audit hash (forward chain: LP → IPFS → verifyAuditHash)
    { delay: 400, sidePanel: sidePanels.verifyAudit, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'lp-ipfs': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'lp-ipfs': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, ipfsRecord: 'active' as NodeState } }) },
    // IPFS data flows down to verification
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, ipfsRecord: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'ipfs-verify': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'ipfs-verify': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, verifyAuditHash: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, verifyAuditHash: 'completed' as NodeState } }) },

    // All verified - results flow to trust table
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'verifyWfId-trust': 'active' as EdgeState, 'verifyHash-trust': 'active' as EdgeState } }) },
    { delay: 500, sidePanel: sidePanels.selfBinding, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'verifyWfId-trust': 'completed' as EdgeState, 'verifyHash-trust': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, lpBackend: 'completed' as NodeState, trustTable: 'active' as NodeState } }) },
    { delay: 1500, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, trustTable: 'completed' as NodeState } }) },
  ]
}

// ── Component ────────────────────────────────────────────────────────

export default function AuditDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState
  const { editMode } = useLayoutEditor()

  useEffect(() => { registerSequence('audit', buildAuditSequence()) }, [registerSequence])

  // Derive activeCheck for Workflow C from existing edge/node states
  const wfCActiveCheck = useMemo(() => {
    if (nodeStates.wfC !== 'active' && nodeStates.wfC !== 'completed') return undefined
    if (nodeStates.registryCheck !== 'completed') return 0 // nothing done yet
    if (edgeStates['wfC-sumsub'] !== 'completed' && edgeStates['wfC-sumsub'] !== 'active') return 2 // first two done
    if (edgeStates['sumsub-wfC-return'] !== 'completed') return 2 // waiting for sumsub
    if (edgeStates['wfC-integrator-return'] !== 'completed') return 3 // sumsub done, encrypting
    return 4 // all done
  }, [nodeStates, edgeStates])

  const nodes: Node[] = useMemo(() => [
    // ═══════════════════════════════════════════════════
    // LEFT: Workflow C - KYC/AML Data Access
    // ═══════════════════════════════════════════════════

    // TEE enclave container
    { id: 'teeLeft', type: 'creEnclaveNode', position: { x: 110, y: 30 },
      style: { zIndex: -1, width: 340, height: 250 },
      data: { label: 'CRE', state: nodeStates.teeLeft || 'idle' },
      draggable: false, selectable: false },

    // Arc container around registries
    { id: 'arcLeft', type: 'chainNode', position: { x: 90, y: 310 },
      style: { zIndex: -1, width: 340, height: 90 },
      data: { chainName: 'Arc', brandColor: '#06b6d4', showHeader: true, state: 'idle' as NodeState },
      draggable: false, selectable: false },

    // Integrator (outside, left)
    { id: 'integrator', type: 'actorNode', position: { x: 0, y: 120 },
      data: { label: 'Integrator', role: 'broker', state: nodeStates.integrator || 'idle' },
      draggable: false, selectable: false },

    // Workflow C (inside TEE)
    { id: 'wfC', type: 'workflowNode', position: { x: 130, y: 80 },
      data: { label: 'Workflow C', description: 'Identity Audit', state: nodeStates.wfC || 'idle',
        checks: ['Read IntegratorRegistry', 'Read CredentialRegistry + check scoping', 'Fetch from Sumsub', 'Encrypt response (AES-GCM)'],
        activeCheck: wfCActiveCheck },
      draggable: false, selectable: false },

    // IntegratorRegistry (inside Arc)
    { id: 'registryCheck', type: 'registryNode', position: { x: 110, y: 340 },
      data: { label: 'IntegratorRegistry', state: nodeStates.registryCheck || 'idle' },
      draggable: false, selectable: false },

    // CredentialRegistry (inside Arc)
    { id: 'credentialCheck', type: 'registryNode', position: { x: 270, y: 340 },
      data: { label: 'CredentialRegistry', state: nodeStates.credentialCheck || 'idle' },
      draggable: false, selectable: false },

    // Sumsub (inside TEE, right side)
    { id: 'sumsubFetch', type: 'providerNode', position: { x: 310, y: 190 },
      data: { label: 'Sumsub', provider: 'sumsub', purpose: 'Fetch KYC/AML', state: nodeStates.sumsubFetch || 'idle' },
      draggable: false, selectable: false },

    // ═══════════════════════════════════════════════════
    // RIGHT: Audit Trail Reconciliation
    // Full verification flow with data flowing between systems
    // ═══════════════════════════════════════════════════

    // LP/Integrator Backend (top center - drives all verification)
    { id: 'lpBackend', type: 'actorNode', position: { x: 680, y: 10 },
      data: { label: 'LP Backend', role: 'lp', state: nodeStates.lpBackend || 'idle' },
      draggable: false, selectable: false },

    // Arc container around on-chain report (below LP)
    { id: 'arcRight', type: 'chainNode', position: { x: 640, y: 120 },
      style: { zIndex: -1, width: 230, height: 160 },
      data: { chainName: 'Arc (on-chain)', brandColor: '#06b6d4', showHeader: true, state: 'idle' as NodeState },
      draggable: false, selectable: false },

    // On-chain ComplianceReport
    { id: 'arcReport', type: 'contractNode', position: { x: 660, y: 160 },
      data: { label: 'ComplianceReport', description: 'getReport(tradeId)', state: nodeStates.arcReport || 'idle',
        checks: ['approved: true', 'workflowId: 0x7a3b...', 'auditHash: 0x9f2e...', 'ipfsCid: QmXyz...'] },
      draggable: false, selectable: false },

    // GitHub source code (below-left of LP)
    { id: 'github', type: 'codeNode', position: { x: 500, y: 130 },
      data: { title: 'GitHub (Open Source)', language: 'Workflow',
        code: '// Compliance workflow code\n// Anyone can read + compile\n// Hash = workflowId',
        state: nodeStates.github || 'idle' },
      draggable: false, selectable: false },

    // IPFS AuditRecord (below-right of LP)
    { id: 'ipfsRecord', type: 'ipfsNode', position: { x: 900, y: 150 },
      data: { label: 'IPFS AuditRecord', state: nodeStates.ipfsRecord || 'idle', cid: 'QmXyz...full-audit' },
      draggable: false, selectable: false },

    // Verification step: workflowId check (below GitHub)
    { id: 'verifyWfId', type: 'codeNode', position: { x: 490, y: 310 },
      data: { title: '✓ Verify workflowId', language: 'Check',
        code: 'compiled = build(source)\nhash = keccak256(compiled)\nhash === report.workflowId\n// ✓ Code matches',
        state: nodeStates.verifyWfId || 'idle' },
      draggable: false, selectable: false },

    // Verification step: auditHash check (below IPFS)
    { id: 'verifyAuditHash', type: 'codeNode', position: { x: 880, y: 310 },
      data: { title: '✓ Verify auditHash', language: 'Check',
        code: 'record = fetch(ipfsCid)\nhash = keccak256(record)\nhash === report.auditHash\n// ✓ Evidence intact',
        state: nodeStates.verifyAuditHash || 'idle' },
      draggable: false, selectable: false },

    // Trust comparison (bottom full width)
    { id: 'trustTable', type: 'comparisonNode', position: { x: 440, y: 500 },
      data: {
        title: 'Self-Binding: Why Trust This System',
        columns: ['Architecture', 'Trust', 'Verifiable?', 'Self-Binding?'],
        rows: [
          ['Centralized backend', 'One server', 'No', 'No'],
          ['Backend + SOC2', 'Operator + auditor', 'Annually', 'No'],
          ['Open Compliance Layer', '≥2/3 of 21 nodes', 'Per trade', 'Yes - code public, ID pinned'],
          ['+ DECO (future)', 'Math (ZK)', 'Cryptographic', 'Yes - zero trust'],
        ],
        highlightRow: 2,
        state: nodeStates.trustTable || 'idle',
      }, draggable: false, selectable: false },
  ], [nodeStates, wfCActiveCheck])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'audit')

  const edges: Edge[] = useMemo(() => [
    // ═══ LEFT: Workflow C ═══
    // Integrator ↔ wfC (RoundTripEdge - request + encrypted response)
    { id: 'integrator-wfC', source: 'integrator', target: 'wfC', type: 'roundTripEdge',
      data: { requestState: edgeStates['integrator-wfC'] || 'idle', responseState: edgeStates['wfC-integrator-return'] || 'idle',
        requestLabel: 'signed HTTP', responseLabel: 'encrypted KYC data' } },
    { id: 'wfC-registry', source: 'wfC', sourceHandle: 'bottom', target: 'registryCheck', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['wfC-registry'] || 'idle', label: 'getIntegrator(wallet)' } },
    { id: 'wfC-credentialReg', source: 'wfC', sourceHandle: 'bottom', target: 'credentialCheck', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['wfC-credentialReg'] || 'idle', label: 'getCredential(ccid)' } },
    // wfC ↔ Sumsub (RoundTripEdge - confidential request + KYC data response)
    { id: 'wfC-sumsub', source: 'wfC', target: 'sumsubFetch', type: 'roundTripEdge',
      data: { requestState: edgeStates['wfC-sumsub'] || 'idle', responseState: edgeStates['sumsub-wfC-return'] || 'idle',
        requestLabel: 'Confidential HTTP (TEE)', responseLabel: 'KYC/AML data', variant: 'confidential' } },

    // ═══ RIGHT: Reconciliation - clean top-to-bottom flows ═══
    // LP ↔ Arc report (RoundTripEdge - parallel request/response lines)
    { id: 'lp-arcReport', source: 'lpBackend', sourceHandle: 'bottom', target: 'arcReport', targetHandle: 'top', type: 'roundTripEdge',
      data: { requestState: edgeStates['lp-arcReport'] || 'idle', responseState: edgeStates['arcReport-lp-return'] || 'idle',
        requestLabel: 'getReport()', responseLabel: 'workflowId + auditHash + ipfsCid' } },

    // LP → GitHub → verifyWfId (forward chain, data flows down)
    { id: 'lp-github', source: 'lpBackend', sourceHandle: 'left', target: 'github', type: 'dataFlowEdge', data: { state: edgeStates['lp-github'] || 'idle', label: 'fetch source' } },
    { id: 'github-verify', source: 'github', target: 'verifyWfId', type: 'dataFlowEdge', data: { state: edgeStates['github-verify'] || 'idle', label: 'source code' } },

    // LP → IPFS → verifyAuditHash (forward chain, data flows down)
    { id: 'lp-ipfs', source: 'lpBackend', target: 'ipfsRecord', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['lp-ipfs'] || 'idle', label: 'fetch by CID' } },
    { id: 'ipfs-verify', source: 'ipfsRecord', sourceHandle: 'bottom', target: 'verifyAuditHash', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['ipfs-verify'] || 'idle', label: 'AuditRecord JSON' } },

    // Verify nodes → Trust table (verification results feed into trust model)
    { id: 'verifyWfId-trust', source: 'verifyWfId', target: 'trustTable', type: 'dataFlowEdge', data: { state: edgeStates['verifyWfId-trust'] || 'idle', label: '✓ Code matches' } },
    { id: 'verifyHash-trust', source: 'verifyAuditHash', target: 'trustTable', type: 'dataFlowEdge', data: { state: edgeStates['verifyHash-trust'] || 'idle', label: '✓ Evidence intact' } },
  ], [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'audit')

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow nodes={editableNodes} edges={editableEdges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onReconnect={onReconnect} onNodeDoubleClick={onNodeDoubleClick} onEdgeDoubleClick={onEdgeDoubleClick} edgesReconnectable={editMode} deleteKeyCode={editMode ? 'Backspace' : null} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={editMode} nodesConnectable={editMode} panOnDrag={!editMode} zoomOnScroll={editMode} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false} fitView fitViewOptions={{ padding: 0.05 }} proOptions={{ hideAttribution: true }} className="bg-surface-900">
          <AutoFitView trigger={nodeStates} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
