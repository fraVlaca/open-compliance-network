import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { HardDrive, Check } from 'lucide-react'
import type { NodeState } from '../types'

export interface IpfsNodeData {
  label: string
  state: NodeState
  cid?: string
  [key: string]: unknown
}

// Indigo color (#6366f1) to distinguish storage from chain operations
const INDIGO = { border: '#6366f1', glow: 'rgba(99, 102, 241,' }

export default function IpfsNode({ data }: NodeProps) {
  const { label, state, cid } = data as unknown as IpfsNodeData

  return (
    <motion.div
      className="rounded-lg border-2 bg-surface-800 px-3 py-2.5 min-w-[150px]"
      style={{
        borderColor: state === 'completed' ? '#10b981' : state === 'active' ? INDIGO.border : '#334155',
      }}
      animate={state === 'active' ? {
        boxShadow: [`0 0 4px ${INDIGO.glow}0.2)`, `0 0 14px ${INDIGO.glow}0.4)`, `0 0 4px ${INDIGO.glow}0.2)`],
      } : { boxShadow: `0 0 0px ${INDIGO.glow}0)` }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="flex items-center gap-2">
        {state === 'completed' ? (
          <Check className="w-3.5 h-3.5 text-positive-500" />
        ) : (
          <HardDrive className="w-3.5 h-3.5" style={{ color: state === 'active' ? INDIGO.border : '#64748b' }} />
        )}
        <span className="text-xs font-semibold" style={{
          color: state === 'active' ? '#a5b4fc' : state === 'completed' ? '#34d399' : '#cbd5e1',
        }}>{label}</span>
      </div>
      <div className="text-[9px] text-slate-600 mt-0.5 pl-5">Content-addressed</div>
      {cid && state === 'completed' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[9px] font-mono mt-1 pl-5 truncate max-w-[170px]" style={{ color: '#818cf8' }}>
          {cid}
        </motion.div>
      )}

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
