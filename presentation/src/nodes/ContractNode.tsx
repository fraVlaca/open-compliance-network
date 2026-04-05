import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { FileCode2, Check, CheckCircle2 } from 'lucide-react'
import type { NodeState } from '../types'

export interface ContractNodeData {
  label: string
  description?: string
  state: NodeState
  checks?: string[]
  activeCheck?: number
  complianceResult?: 'approved' | 'rejected'
  [key: string]: unknown
}

export default function ContractNode({ data }: NodeProps) {
  const { label, description, state, checks, activeCheck, complianceResult } = data as unknown as ContractNodeData

  const borderColor =
    state === 'completed' ? (complianceResult === 'rejected' ? 'border-negative-500' : 'border-positive-500') :
    state === 'active' ? 'border-chain-500' :
    'border-slate-700'

  return (
    <motion.div
      className={`rounded-lg border-2 bg-surface-800 px-4 py-3 min-w-[180px] ${borderColor}`}
      animate={state === 'active' ? {
        boxShadow: ['0 0 6px rgba(6,182,212,0.2)', '0 0 16px rgba(6,182,212,0.4)', '0 0 6px rgba(6,182,212,0.2)'],
      } : { boxShadow: '0 0 0px rgba(6,182,212,0)' }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-1">
        {state === 'completed' ? (
          <Check className={`w-3.5 h-3.5 ${complianceResult === 'rejected' ? 'text-negative-500' : 'text-positive-500'}`} />
        ) : (
          <FileCode2 className={`w-3.5 h-3.5 ${state === 'active' ? 'text-chain-400' : 'text-slate-500'}`} />
        )}
        <span className={`text-xs font-semibold ${
          state === 'active' ? 'text-chain-300' :
          state === 'completed' ? (complianceResult === 'rejected' ? 'text-negative-400' : 'text-positive-400') :
          'text-slate-300'
        }`}>{label}</span>
      </div>

      {description && <div className="text-[10px] text-slate-500 mt-0.5">{description}</div>}

      {checks && checks.length > 0 && (
        <div className="mt-2 space-y-1">
          {checks.map((check, i) => {
            const checkState = activeCheck !== undefined
              ? i < activeCheck ? 'done' : i === activeCheck ? 'active' : 'pending'
              : state === 'completed' ? 'done' : 'pending'
            return (
              <motion.div key={i} className="flex items-center gap-1.5 text-[10px]"
                initial={{ opacity: 0.4 }} animate={{ opacity: checkState === 'pending' ? 0.4 : 1 }}
              >
                <CheckCircle2 className={`w-3 h-3 ${
                  checkState === 'done' ? 'text-positive-500' :
                  checkState === 'active' ? 'text-chain-400' : 'text-slate-600'
                }`} />
                <span className={checkState === 'done' ? 'text-positive-400' : checkState === 'active' ? 'text-chain-300' : 'text-slate-600'}>
                  {check}
                </span>
              </motion.div>
            )
          })}
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
