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

const STEPS = [
  { id: 'step1', step: 1, title: 'Protocol wants institutional capital', description: 'Banks, asset managers, regulated LPs cannot interact with anonymous counterparties. Without compliance: no institutional money.' },
  { id: 'step2', step: 2, title: 'Adds KYC infrastructure', description: 'Someone must hold the Sumsub account, manage API keys, store/process PII (passports, addresses), respond to GDPR requests.' },
  { id: 'step3', step: 3, title: 'Creates a legal entity', description: 'A foundation or company must operate the KYC backend. FATF: "entity exercising control = VASP." The entity crystallizes.' },
  { id: 'step4', step: 4, title: 'Classified as CASP under MiCA', description: 'Identifiable entity providing crypto-asset services = CASP. Must license in home member state. Lost the "fully decentralized" exemption.' },
  { id: 'step5', step: 5, title: 'Regulatory escalator — no stop button', description: 'KYC → transaction monitoring → Travel Rule → SAR filing → compliance officer → capital reserves → 5-year record keeping → annual audits' },
  { id: 'step6', step: 6, title: 'The deadlock', description: 'Most protocols choose NOT to add KYC — forgoing institutional capital. Aave Arc tried: created a centralized sidecar, fragmented liquidity, didn\'t scale.' },
]

const sidePanels: Record<string, SidePanelData> = {
  initial: {
    stage: 'Problem',
    beat: 'The Compliance Catch-22',
    title: 'The Institutional Demand',
    json: {
      'The demand': 'Institutional capital wants compliant DeFi access',
      'The blocker': 'DeFi protocols have no KYC infrastructure',
      'The trap': 'Adding KYC destroys decentralization — and triggers CASP classification',
      'EU DeFi impact (2025)': {
        'DEX volume decline': '-18.9% Q1 2025 (largest ever)',
        'Wallet creation decline': '-22%',
        'Users switching offshore': '40%+ of EU traders',
      },
      'ECB warning': 'Most DeFi DAOs don\'t meet "fully decentralized" threshold — governance token concentration, upgrade mechanisms, treasury control all count against them',
    },
    highlightFields: ['The trap', 'EU DeFi impact (2025)', 'ECB warning'],
  },
  entity: {
    stage: 'Problem',
    beat: 'Entity Crystallization',
    title: 'WHO Runs the KYC?',
    json: {
      'Someone must': ['Hold the Sumsub account', 'Manage Chainalysis API keys', 'Store/process PII (passports, addresses)', 'Respond to GDPR deletion requests', 'Sign Data Processing Agreements', 'Make approval/denial decisions'],
      'That someone': 'Must be a legal entity — foundation, company, or DAO',
      'FATF position': 'Identifiable entity with control over protocol access = VASP, regardless of "decentralized" label',
      'Censorship vector': 'Whoever controls KYC controls access. One entity decides who can use the "decentralized" protocol.',
    },
    highlightFields: ['That someone', 'FATF position', 'Censorship vector'],
  },
  casp: {
    stage: 'Problem',
    beat: 'CASP Classification',
    title: 'MiCA Obligations (July 2026)',
    json: {
      'CASP licensing': 'Apply for license in home member state',
      'Compliance officer': 'Dedicated personnel required',
      'Capital requirements': 'Maintain minimum reserves',
      'Transaction monitoring': 'Real-time, all transactions',
      'Travel Rule': 'Exchange originator/beneficiary data (deadline July 2026)',
      'SAR filing': 'Report suspicious activity to FIU',
      'Record keeping': '5-year retention of ALL compliance actions',
      'Annual audits': 'External regulatory audits',
      'Consumer protection': 'Disclosure requirements, complaint handling',
      'Asset segregation': 'Separate customer funds from operational funds',
    },
    highlightFields: ['CASP licensing', 'Travel Rule', 'Record keeping'],
  },
  deadlock: {
    stage: 'Problem',
    beat: 'The Deadlock',
    title: 'Every Option Loses',
    json: {
      'Option A — Add KYC': 'Entity crystallization → CASP → regulatory escalator → "decentralized in name only"',
      'Option B — Stay decentralized': 'No institutional capital. Shrinking EU market. Excluded from fastest-growing segment.',
      'Option C — Geo-block EU': 'Lose EU market entirely. Whack-a-mole as more jurisdictions regulate.',
      'Aave Arc precedent': 'Tried a permissioned sidecar with Fireblocks whitelisting. Created a centralized product, fragmented liquidity, Fireblocks CEO admitted "it does go against DeFi principles."',
      'Result': 'Most protocols choose Option B. Institutions stay out. Everyone loses.',
      'What\'s needed': 'A way to serve institutions WITHOUT becoming the KYC operator',
    },
    highlightFields: ['Aave Arc precedent', 'Result', 'What\'s needed'],
  },
}

function buildProblemSequence(): StageSequence {
  return [
    // Step 1: Protocol wants institutions
    { delay: 300, sidePanel: sidePanels.initial, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, step1: 'active' as NodeState } }) },
    { delay: 1200, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, step1: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'step1-step2': 'active' as EdgeState } }) },
    // Step 2: Adds KYC
    { delay: 400, sidePanel: sidePanels.entity, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'step1-step2': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, step2: 'active' as NodeState } }) },
    { delay: 1000, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, step2: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'step2-step3': 'active' as EdgeState } }) },
    // Step 3: Creates entity
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'step2-step3': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, step3: 'active' as NodeState } }) },
    { delay: 1000, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, step3: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'step3-step4': 'active' as EdgeState } }) },
    // Step 4: CASP classification
    { delay: 400, sidePanel: sidePanels.casp, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'step3-step4': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, step4: 'active' as NodeState } }) },
    { delay: 1200, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, step4: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'step4-step5': 'active' as EdgeState } }) },
    // Step 5: Regulatory escalator
    { delay: 400, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'step4-step5': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, step5: 'active' as NodeState } }) },
    { delay: 1200, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, step5: 'completed' as NodeState }, edgeStates: { ...s.edgeStates, 'step5-step6': 'active' as EdgeState } }) },
    // Step 6: The deadlock
    { delay: 400, sidePanel: sidePanels.deadlock, apply: (s: FlowState) => ({ edgeStates: { ...s.edgeStates, 'step5-step6': 'completed' as EdgeState }, nodeStates: { ...s.nodeStates, step6: 'active' as NodeState } }) },
    // Final: all complete — the trap is closed
    { delay: 1500, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, step6: 'completed' as NodeState } }) },
  ]
}

export default function ProblemDrillDown() {
  const { state, registerSequence } = usePlayback()
  const { nodeStates, edgeStates } = state.flowState

  useEffect(() => {
    registerSequence('problem', buildProblemSequence())
  }, [registerSequence])

  const { editMode } = useLayoutEditor()

  const nodes: Node[] = useMemo(() => {
    // Two columns: steps 1-3 left, steps 4-6 right — shows the escalation
    const cols = [
      { x: 20, y: 30 },   // step 1
      { x: 20, y: 180 },  // step 2
      { x: 20, y: 330 },  // step 3
      { x: 400, y: 30 },  // step 4
      { x: 400, y: 180 }, // step 5
      { x: 400, y: 330 }, // step 6
    ]

    return STEPS.map((step, i) => ({
      id: step.id,
      type: 'problemStepNode',
      position: cols[i],
      data: {
        step: step.step,
        title: step.title,
        description: step.description,
        state: (nodeStates[step.id] as NodeState) || 'idle',
      },
      draggable: false,
      selectable: false,
    }))
  }, [nodeStates])

  const { editableNodes, onNodesChange, onNodeDoubleClick } = useEditableNodes(nodes, 'problem')

  const edges: Edge[] = useMemo(() => {
    // Vertical edges within columns, horizontal edge crossing columns
    const edgeDefs = [
      { id: 'step1-step2', source: 'step1', target: 'step2' },
      { id: 'step2-step3', source: 'step2', target: 'step3' },
      { id: 'step3-step4', source: 'step3', target: 'step4', sourceHandle: 'right', targetHandle: 'left' }, // cross to right column
      { id: 'step4-step5', source: 'step4', target: 'step5' },
      { id: 'step5-step6', source: 'step5', target: 'step6' },
    ]
    return edgeDefs.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: 'dataFlowEdge',
      data: { state: (edgeStates[e.id] as EdgeState) || 'idle' },
    }))
  }, [edgeStates])

  const { editableEdges, onEdgesChange, onConnect, onReconnect, onEdgeDoubleClick } = useEditableEdges(edges, 'problem')

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
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          className="bg-surface-900"
        >
          <AutoFitView trigger={nodeStates} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
