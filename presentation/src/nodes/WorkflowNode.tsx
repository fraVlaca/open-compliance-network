import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { Lock, CheckCircle2 } from 'lucide-react'
import type { NodeState } from '../types'

export interface WorkflowNodeData {
  label: string
  description?: string
  state: NodeState
  checks?: string[]
  activeCheck?: number
  [key: string]: unknown
}

export default function WorkflowNode({ data }: NodeProps) {
  const { label, description, state, checks, activeCheck } = data as unknown as WorkflowNodeData

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? 'border-tee-500' :
    'border-slate-700'

  return (
    <div className="relative">
      <motion.div
        className={`rounded-lg border-2 ${borderColor} bg-surface-800 px-4 py-3 min-w-[200px]`}
        animate={state === 'active' ? {
          boxShadow: [
            '0 0 8px rgba(139, 92, 246, 0.2)',
            '0 0 24px rgba(139, 92, 246, 0.4)',
            '0 0 8px rgba(139, 92, 246, 0.2)',
          ],
        } : {
          boxShadow: '0 0 0px rgba(139, 92, 246, 0)',
        }}
        transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
      >
        {/* TEE Header */}
        <div className="flex items-center gap-2 mb-1">
          <Lock className={`w-3.5 h-3.5 ${state === 'active' ? 'text-tee-400' : 'text-slate-500'}`} />
          <span className="text-[10px] font-mono text-tee-400 uppercase tracking-wider">CRE Workflow</span>
        </div>

        {/* Workflow name */}
        <div className={`text-sm font-semibold ${
          state === 'active' ? 'text-tee-300' :
          state === 'completed' ? 'text-positive-400' :
          'text-slate-300'
        }`}>
          {label}
        </div>

        {description && (
          <div className="text-[10px] text-slate-500 mt-0.5">{description}</div>
        )}

        {/* Check list */}
        {checks && checks.length > 0 && (
          <div className="mt-2 space-y-1">
            {checks.map((check, i) => {
              const checkState = activeCheck !== undefined
                ? i < activeCheck ? 'done' : i === activeCheck ? 'active' : 'pending'
                : state === 'completed' ? 'done' : 'pending'
              return (
                <motion.div
                  key={i}
                  className="flex items-center gap-1.5 text-[10px]"
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: checkState === 'pending' ? 0.4 : 1 }}
                >
                  <CheckCircle2 className={`w-3 h-3 ${
                    checkState === 'done' ? 'text-positive-500' :
                    checkState === 'active' ? 'text-tee-400' :
                    'text-slate-600'
                  }`} />
                  <span className={
                    checkState === 'done' ? 'text-positive-400' :
                    checkState === 'active' ? 'text-tee-300' :
                    'text-slate-600'
                  }>{check}</span>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  )
}
