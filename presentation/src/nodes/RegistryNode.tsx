import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { Database, Check } from 'lucide-react'
import type { NodeState } from '../types'

export interface RegistryNodeData {
  label: string
  state: NodeState
  entryCount?: number
  [key: string]: unknown
}

export default function RegistryNode({ data }: NodeProps) {
  const { label, state, entryCount } = data as unknown as RegistryNodeData

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? 'border-chain-500' :
    'border-slate-700'

  return (
    <motion.div
      className={`rounded-lg border-2 bg-surface-800 px-3 py-2.5 min-w-[140px] ${borderColor}`}
      animate={state === 'active' ? {
        boxShadow: ['0 0 4px rgba(6,182,212,0.2)', '0 0 12px rgba(6,182,212,0.35)', '0 0 4px rgba(6,182,212,0.2)'],
      } : { boxShadow: '0 0 0px rgba(6,182,212,0)' }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="flex items-center gap-2">
        {state === 'completed' ? (
          <Check className="w-3.5 h-3.5 text-positive-500" />
        ) : (
          <Database className={`w-3.5 h-3.5 ${state === 'active' ? 'text-chain-400' : 'text-slate-500'}`} />
        )}
        <span className={`text-xs font-semibold ${
          state === 'active' ? 'text-chain-300' :
          state === 'completed' ? 'text-positive-400' :
          'text-slate-300'
        }`}>{label}</span>
      </div>
      {entryCount !== undefined && (
        <div className="text-[10px] text-slate-600 mt-0.5 pl-5">{entryCount} entries</div>
      )}

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
