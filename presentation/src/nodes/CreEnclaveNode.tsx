import { Handle, Position, NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { Lock } from 'lucide-react'
import type { NodeState } from '../types'

export interface CreEnclaveNodeData {
  label?: string
  state: NodeState
  dimmed?: boolean
  _editMode?: boolean
  [key: string]: unknown
}

export default function CreEnclaveNode({ data }: NodeProps) {
  const { label, state, dimmed, _editMode } = data as unknown as CreEnclaveNodeData

  return (
    <motion.div
      className="rounded-lg bg-tee-500/5 w-full h-full overflow-visible"
      style={{ border: '1px solid rgba(139, 92, 246, 0.3)' }}
      animate={{
        opacity: dimmed ? 0.5 : 1,
        borderColor: state === 'active'
          ? ['rgba(139, 92, 246, 0.3)', 'rgba(139, 92, 246, 0.6)', 'rgba(139, 92, 246, 0.3)']
          : 'rgba(139, 92, 246, 0.3)',
      }}
      transition={state === 'active' ? { duration: 3, repeat: Infinity } : { duration: 0.5 }}
    >
      {_editMode && (
        <NodeResizer
          minWidth={200}
          minHeight={120}
          handleStyle={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(139 92 246 / 0.7)', border: '1px solid rgb(139 92 246)' }}
          lineStyle={{ borderColor: 'rgb(139 92 246 / 0.3)' }}
        />
      )}
      {/* TEE Header bar */}
      <div className="px-3 py-1.5 flex items-center gap-2" style={{ backgroundColor: 'rgba(139, 92, 246, 0.08)' }}>
        <Lock className="w-3 h-3 text-tee-400" />
        <span className="text-xs font-mono font-semibold tracking-wider text-tee-400">
          {label || 'CRE Enclave'}
        </span>
        <span className="text-[9px] font-mono text-tee-600 ml-auto">Chainlink DON · 21 nodes</span>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
