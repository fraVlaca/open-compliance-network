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
  workflowC: {
    stage: 'Audit', beat: 'Workflow C — Identity Audit', title: 'KYC/AML Data Access',
    json: {
      'Trigger': 'Integrator signs HTTP request with wallet',
      'CRE Workflow C (TEE)': {
        '1': 'Read IntegratorRegistry → get appId, workspace, role',
        '2': 'Check CredentialRegistry → does user belong to requester scope?',
        '3': 'Confidential HTTP → Sumsub: fetch via namespaced externalUserId',
        '4': 'Return encrypted to integrator public key',
      },
      'Scoping': { 'Broker': 'Only users they onboarded', 'LP': 'Only users in their trades', 'Protocol': 'All users in workspace' },
      'PII never stored': 'Fetched from Sumsub on-demand in TEE. Never in audit trail.',
    },
    highlightFields: ['CRE Workflow C (TEE)', 'Scoping', 'PII never stored'],
  },
  reconciliation: {
    stage: 'Audit', beat: 'Audit Reconciliation', title: 'Trust Verification Flow',
    json: {
      'Step 1 — Read on-chain report': 'getReport(tradeId) → { approved, riskScore, auditHash, ipfsCid, workflowId }',
      'Step 2 — Verify workflow code': { 'Source': 'Open source on GitHub', 'Compile': 'cre workflow build → binary hash', 'Compare': 'hash == on-chain workflowId? → This exact code ran' },
      'Step 3 — Fetch IPFS record': 'GET gateway.pinata.cloud/ipfs/{cid} → full AuditRecord',
      'Step 4 — Verify hash': 'keccak256(record) === on-chain auditHash? → Data untampered',
      'Result': 'You know WHAT code ran + WHAT it decided + the FULL evidence + ALL immutable',
    },
    highlightFields: ['Step 2 — Verify workflow code', 'Step 4 — Verify hash', 'Result'],
  },
  selfBinding: {
    stage: 'Audit', beat: 'Self-Binding', title: 'Why This Matters',
    json: {
      'Self-binding': 'Open code + pinned workflowId + DON consensus = operator CANNOT cheat',
      'If code changes': 'New binary → new workflowId → consumer contract rejects',
      'Centralized alt': 'Trust one server. Could selectively approve. No proof otherwise.',
      'What we built': '≥2/3 of 21 DON nodes. Public code. Immutable audit trail per trade.',
      'DECO (future)': 'ZK proof of TLS — mathematical proof Sumsub returned "verified"',
    },
    highlightFields: ['Self-binding', 'What we built'],
  },
}

function buildAuditSequence(): StageSequence {
  return [
    // LEFT: Workflow C
    { delay: 300, sidePanel: sidePanels.workflowC, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, integrator: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, integrator: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'integrator-wfC': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'integrator-wfC': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, wfC: 'active' as NodeState, teeLeft: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-registry': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-registry': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, registryCheck: 'active' as NodeState } }) },
    { delay: 600, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, registryCheck: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'wfC-sumsub': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-sumsub': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, sumsubFetch: 'active' as NodeState } }) },
    { delay: 700, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, sumsubFetch: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'wfC-encrypted': 'active' as EdgeState } }) },
    { delay: 500, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'wfC-encrypted': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, wfC: 'completed' as NodeState, teeLeft: 'completed' as NodeState, encryptedResult: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, encryptedResult: 'completed' as NodeState } }) },
    // RIGHT: Reconciliation
    { delay: 600, sidePanel: sidePanels.reconciliation, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, readReport: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, readReport: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'report-verifyCode': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'report-verifyCode': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, verifyCode: 'active' as NodeState } }) },
    { delay: 1000, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, verifyCode: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'report-fetchIpfs': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'report-fetchIpfs': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, fetchIpfs: 'active' as NodeState } }) },
    { delay: 800, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, fetchIpfs: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'ipfs-verifyHash': 'active' as EdgeState } }) },
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'ipfs-verifyHash': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, verifyHash: 'active' as NodeState } }) },
    { delay: 1000, sidePanel: sidePanels.selfBinding, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, verifyHash: 'completed' as NodeState, trustTable: 'active' as NodeState } }) },
    { delay: 1500, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, trustTable: 'completed' as NodeState } }) },
  ]
}

export default function AuditDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState
  const { editMode } = useLayoutEditor()

  useEffect(() => { registerSequence('audit', buildAuditSequence()) }, [registerSequence])

  const nodes: Node[] = useMemo(() => [
    // ═══ LEFT: Workflow C ═══
    { id: 'teeLeft', type: 'creEnclaveNode', position: { x: 100, y: 40 },
      style: { zIndex: -1, width: 320, height: 320 },
      data: { label: 'CRE / TEE — Workflow C', state: nodeStates.teeLeft || 'idle' },
      draggable: false, selectable: false },

    { id: 'integrator', type: 'actorNode', position: { x: 0, y: 140 },
      data: { label: 'Integrator', role: 'broker', state: nodeStates.integrator || 'idle' },
      draggable: false, selectable: false },

    { id: 'wfC', type: 'workflowNode', position: { x: 120, y: 90 },
      data: { label: 'Workflow C', description: 'Identity Audit', state: nodeStates.wfC || 'idle',
        checks: ['Read IntegratorRegistry', 'Check scoping (appId)', 'Fetch from Sumsub', 'Encrypt to integrator key'] },
      draggable: false, selectable: false },

    { id: 'registryCheck', type: 'registryNode', position: { x: 120, y: 280 },
      data: { label: 'IntegratorRegistry', state: nodeStates.registryCheck || 'idle' },
      draggable: false, selectable: false },

    { id: 'sumsubFetch', type: 'providerNode', position: { x: 290, y: 280 },
      data: { label: 'Sumsub', provider: 'sumsub', purpose: 'Fetch KYC/AML', state: nodeStates.sumsubFetch || 'idle' },
      draggable: false, selectable: false },

    { id: 'encryptedResult', type: 'actorNode', position: { x: 0, y: 310 },
      data: { label: 'Encrypted Result', role: 'broker', state: nodeStates.encryptedResult || 'idle' },
      draggable: false, selectable: false },

    // ═══ RIGHT: Reconciliation ═══
    { id: 'readReport', type: 'contractNode', position: { x: 490, y: 30 },
      data: { label: 'Read On-Chain Report', description: 'getReport(tradeId)', state: nodeStates.readReport || 'idle',
        checks: ['approved: true', 'riskScore: 2', 'auditHash: 0x9f2e...', 'ipfsCid: QmXyz...', 'workflowId: 0x7a3b...'] },
      draggable: false, selectable: false },

    { id: 'verifyCode', type: 'codeNode', position: { x: 480, y: 230 },
      data: { title: 'Verify Workflow Code', language: 'Shell',
        code: '# Read open-source code\n# Compile: cre workflow build\n# Compare hash:\nworkflowId == keccak256(binary)\n# ✓ This EXACT code ran',
        state: nodeStates.verifyCode || 'idle' },
      draggable: false, selectable: false },

    { id: 'fetchIpfs', type: 'ipfsNode', position: { x: 740, y: 40 },
      data: { label: 'Fetch IPFS Record', state: nodeStates.fetchIpfs || 'idle', cid: 'QmXyz...audit' },
      draggable: false, selectable: false },

    { id: 'verifyHash', type: 'codeNode', position: { x: 700, y: 230 },
      data: { title: 'Verify Audit Hash', language: 'JavaScript',
        code: 'const record = fetch(ipfsCid)\nconst hash = keccak256(record)\nhash === report.auditHash\n// ✓ Data untampered',
        state: nodeStates.verifyHash || 'idle' },
      draggable: false, selectable: false },

    { id: 'trustTable', type: 'comparisonNode', position: { x: 440, y: 420 },
      data: {
        title: 'Self-Binding: Why Trust This System',
        columns: ['Architecture', 'Trust', 'Verifiable?', 'Self-Binding?'],
        rows: [
          ['Centralized backend', 'One server', 'No', 'No'],
          ['Backend + SOC2', 'Operator + auditor', 'Annually', 'No'],
          ['Open Compliance Layer', '≥2/3 of 21 nodes', 'Per trade', 'Yes — code public, ID pinned'],
          ['+ DECO (future)', 'Math (ZK)', 'Cryptographic', 'Yes — zero trust'],
        ],
        highlightRow: 2,
        state: nodeStates.trustTable || 'idle',
      }, draggable: false, selectable: false },
  ], [nodeStates])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'audit')

  const edges: Edge[] = useMemo(() => [
    // LEFT: Workflow C
    { id: 'integrator-wfC', source: 'integrator', target: 'wfC', type: 'dataFlowEdge', data: { state: edgeStates['integrator-wfC'] || 'idle', label: 'signed HTTP' } },
    { id: 'wfC-registry', source: 'wfC', sourceHandle: 'bottom', target: 'registryCheck', targetHandle: 'top', type: 'dataFlowEdge', data: { state: edgeStates['wfC-registry'] || 'idle' } },
    { id: 'wfC-sumsub', source: 'wfC', target: 'sumsubFetch', type: 'confidentialEdge', data: { state: edgeStates['wfC-sumsub'] || 'idle' } },
    { id: 'wfC-encrypted', source: 'wfC', target: 'encryptedResult', type: 'dataFlowEdge', data: { state: edgeStates['wfC-encrypted'] || 'idle', label: 'encrypted' } },
    // RIGHT: Reconciliation
    { id: 'report-verifyCode', source: 'readReport', sourceHandle: 'bottom', target: 'verifyCode', type: 'dataFlowEdge', data: { state: edgeStates['report-verifyCode'] || 'idle', label: 'workflowId' } },
    { id: 'report-fetchIpfs', source: 'readReport', target: 'fetchIpfs', type: 'dataFlowEdge', data: { state: edgeStates['report-fetchIpfs'] || 'idle', label: 'ipfsCid' } },
    { id: 'ipfs-verifyHash', source: 'fetchIpfs', sourceHandle: 'bottom', target: 'verifyHash', type: 'dataFlowEdge', data: { state: edgeStates['ipfs-verifyHash'] || 'idle', label: 'auditHash' } },
  ], [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'audit')

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
