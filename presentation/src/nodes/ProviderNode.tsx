import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { Shield, Eye, Send, Check } from 'lucide-react'
import type { NodeState } from '../types'

export interface ProviderNodeData {
  label: string
  purpose?: string
  provider: 'sumsub' | 'chainalysis' | 'notabene'
  state: NodeState
  [key: string]: unknown
}

const providerConfig = {
  sumsub: { icon: Shield, color: '#10b981', label: 'Identity' },
  chainalysis: { icon: Eye, color: '#3b82f6', label: 'Analytics' },
  notabene: { icon: Send, color: '#f59e0b', label: 'Travel Rule' },
}

export default function ProviderNode({ data }: NodeProps) {
  const { label, purpose, provider, state } = data as unknown as ProviderNodeData
  const config = providerConfig[provider]
  const Icon = config.icon

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? `border-[${config.color}]` :
    'border-slate-700'

  return (
    <motion.div
      className={`rounded-lg border-2 bg-surface-800 px-4 py-3 min-w-[160px] ${borderColor}`}
      style={state === 'active' ? { borderColor: config.color } : undefined}
      animate={state === 'active' ? {
        boxShadow: [
          `0 0 6px ${config.color}33`,
          `0 0 18px ${config.color}55`,
          `0 0 6px ${config.color}33`,
        ],
      } : {
        boxShadow: `0 0 0px ${config.color}00`,
      }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-1">
        {state === 'completed' ? (
          <Check className="w-4 h-4 text-positive-500" />
        ) : (
          <Icon className="w-4 h-4" style={{ color: state === 'active' ? config.color : '#64748b' }} />
        )}
        <span className="text-xs font-semibold" style={{ color: state === 'active' ? config.color : state === 'completed' ? '#10b981' : '#94a3b8' }}>
          {label}
        </span>
      </div>
      <div className="text-[10px] text-slate-500">{purpose || config.label}</div>

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
