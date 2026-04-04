import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { NodeState } from '../types'

export interface ProblemStepNodeData {
  step: number
  title: string
  description?: string
  state: NodeState
  [key: string]: unknown
}

export default function ProblemStepNode({ data }: NodeProps) {
  const { step, title, description, state } = data as unknown as ProblemStepNodeData

  const borderColor =
    state === 'completed' ? 'border-negative-500' :
    state === 'active' ? 'border-negative-400' :
    'border-slate-700'

  const bgColor =
    state === 'completed' ? 'bg-negative-500/5' :
    state === 'active' ? 'bg-negative-500/10' :
    'bg-surface-800'

  return (
    <motion.div
      className={`rounded-lg border-2 px-4 py-3 min-w-[280px] ${borderColor} ${bgColor}`}
      animate={state === 'active' ? {
        boxShadow: [
          '0 0 6px rgba(239, 68, 68, 0.2)',
          '0 0 20px rgba(239, 68, 68, 0.4)',
          '0 0 6px rgba(239, 68, 68, 0.2)',
        ],
      } : state === 'completed' ? {
        boxShadow: '0 0 8px rgba(239, 68, 68, 0.15)',
      } : {
        boxShadow: '0 0 0px rgba(239, 68, 68, 0)',
      }}
      transition={state === 'active' ? { duration: 1.5, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 text-xs font-bold ${
          state === 'active' || state === 'completed' ? 'border-negative-500 text-negative-400 bg-negative-500/20' : 'border-slate-600 text-slate-500'
        }`}>
          {step}
        </div>
        <div>
          <div className={`text-sm font-semibold ${
            state === 'active' ? 'text-negative-300' :
            state === 'completed' ? 'text-negative-400' :
            'text-slate-400'
          }`}>{title}</div>
          {description && (
            <div className={`text-[10px] mt-0.5 ${
              state === 'active' || state === 'completed' ? 'text-slate-400' : 'text-slate-600'
            }`}>{description}</div>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
