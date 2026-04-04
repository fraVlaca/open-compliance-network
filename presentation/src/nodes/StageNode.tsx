import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, AlertTriangle, Search, Zap, UserCheck, ArrowRightLeft, FileCheck, Code } from 'lucide-react'
import type { NodeState } from '../types'

export interface StageNodeData {
  label: string
  state: NodeState
  stageId: string
  onClick?: (stageId: string) => void
  [key: string]: unknown
}

const stageIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  problem: AlertTriangle,
  gap: Search,
  solution: Zap,
  kyc: UserCheck,
  trade: ArrowRightLeft,
  audit: FileCheck,
  integration: Code,
}

// All active stages glow yellow/gold
const ACTIVE_COLOR = 'var(--warning-500, #f59e0b)'

export default function StageNode({ data }: NodeProps) {
  const { label, state, stageId, onClick } = data as unknown as StageNodeData
  const Icon = stageIcons[stageId]

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? 'border-warning-500' :
    'border-slate-600'

  const bgColor =
    state === 'completed' ? 'bg-positive-500/10' :
    state === 'active' ? 'bg-warning-500/10' :
    'bg-surface-800'

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center cursor-pointer ${borderColor} ${bgColor}`}
        animate={
          state === 'active' ? {
            boxShadow: [
              '0 0 0 0px rgba(245, 158, 11, 0)',
              '0 0 0 8px rgba(245, 158, 11, 0.15)',
              '0 0 0 0px rgba(245, 158, 11, 0)',
            ],
          } : state === 'completed' ? {
            boxShadow: '0 0 0 6px rgba(245, 158, 11, 0.12)',
          } : {
            boxShadow: '0 0 0 0px rgba(245, 158, 11, 0)',
          }
        }
        transition={state === 'active' ? { duration: 1.5, repeat: Infinity } : { duration: 0.3 }}
        onClick={() => onClick?.(stageId)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {state === 'completed' ? (
            <motion.div
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Check className="w-5 h-5 text-positive-500" />
            </motion.div>
          ) : Icon ? (
            <motion.div key="icon" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Icon
                className={`w-5 h-5 ${state === 'active' ? '' : 'text-slate-400'}`}
                {...(state === 'active' ? { color: ACTIVE_COLOR } : {})}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      <span className={`text-xs font-mono ${
        state === 'active' ? 'text-warning-400' :
        state === 'completed' ? 'text-positive-400' :
        'text-slate-500'
      }`}>
        {label}
      </span>
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  )
}
