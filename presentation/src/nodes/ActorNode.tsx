import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { User, Building, Landmark, Vault, Scale, Monitor } from 'lucide-react'
import type { NodeState } from '../types'

export interface ActorNodeData {
  label: string
  role: 'user' | 'broker' | 'lp' | 'custodian' | 'regulator' | 'frontend'
  state: NodeState
  [key: string]: unknown
}

const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  broker: Building,
  lp: Landmark,
  custodian: Vault,
  regulator: Scale,
  frontend: Monitor,
}

export default function ActorNode({ data }: NodeProps) {
  const { label, role, state } = data as unknown as ActorNodeData
  const Icon = roleIcons[role] || User

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? 'border-primary-500' :
    'border-slate-700'

  return (
    <motion.div
      className={`rounded-lg border-2 bg-surface-800 px-3 py-2.5 min-w-[120px] flex flex-col items-center gap-1.5 ${borderColor}`}
      animate={state === 'active' ? {
        boxShadow: ['0 0 6px rgba(59,130,246,0.2)', '0 0 16px rgba(59,130,246,0.4)', '0 0 6px rgba(59,130,246,0.2)'],
      } : { boxShadow: '0 0 0px rgba(59,130,246,0)' }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <Icon className={`w-5 h-5 ${
        state === 'active' ? 'text-primary-400' :
        state === 'completed' ? 'text-positive-400' :
        'text-slate-500'
      }`} />
      <span className={`text-xs font-mono ${
        state === 'active' ? 'text-primary-300' :
        state === 'completed' ? 'text-positive-400' :
        'text-slate-400'
      }`}>{label}</span>

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Left} id="left" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="target" position={Position.Top} id="top" className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
