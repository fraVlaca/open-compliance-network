import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { Scale, CheckCircle2 } from 'lucide-react'
import type { NodeState } from '../types'

export interface RuleEngineNodeData {
  label: string
  state: NodeState
  rules?: string[]
  activeRule?: number
  [key: string]: unknown
}

export default function RuleEngineNode({ data }: NodeProps) {
  const { label, state, rules, activeRule } = data as unknown as RuleEngineNodeData

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? 'border-warning-500' :
    'border-slate-700'

  return (
    <motion.div
      className={`rounded-lg border-2 bg-surface-800 px-4 py-3 min-w-[180px] ${borderColor}`}
      animate={state === 'active' ? {
        boxShadow: ['0 0 6px rgba(245,158,11,0.2)', '0 0 16px rgba(245,158,11,0.35)', '0 0 6px rgba(245,158,11,0.2)'],
      } : { boxShadow: '0 0 0px rgba(245,158,11,0)' }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Scale className={`w-3.5 h-3.5 ${state === 'active' ? 'text-warning-400' : 'text-slate-500'}`} />
        <span className={`text-xs font-semibold ${
          state === 'active' ? 'text-warning-300' : state === 'completed' ? 'text-positive-400' : 'text-slate-300'
        }`}>{label}</span>
      </div>

      {rules && rules.length > 0 && (
        <div className="mt-2 space-y-1">
          {rules.map((rule, i) => {
            const ruleState = activeRule !== undefined
              ? i < activeRule ? 'done' : i === activeRule ? 'active' : 'pending'
              : state === 'completed' ? 'done' : 'pending'
            return (
              <motion.div key={i} className="flex items-center gap-1.5 text-[10px]"
                initial={{ opacity: 0.4 }} animate={{ opacity: ruleState === 'pending' ? 0.4 : 1 }}
              >
                <CheckCircle2 className={`w-3 h-3 ${
                  ruleState === 'done' ? 'text-positive-500' :
                  ruleState === 'active' ? 'text-warning-400' : 'text-slate-600'
                }`} />
                <span className={
                  ruleState === 'done' ? 'text-positive-400' :
                  ruleState === 'active' ? 'text-warning-300' : 'text-slate-600'
                }>{rule}</span>
              </motion.div>
            )
          })}
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
