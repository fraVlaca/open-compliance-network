import { Handle, Position, NodeResizer } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { NodeState } from '../types'

export interface ChainNodeData {
  chainName: string
  chainId?: number
  brandColor: string
  state: NodeState
  dimmed?: boolean
  showHeader?: boolean
  _editMode?: boolean
  [key: string]: unknown
}

export default function ChainNode({ data }: NodeProps) {
  const { chainName, chainId, brandColor, state, dimmed, showHeader, _editMode } = data as unknown as ChainNodeData

  if (showHeader) {
    return (
      <motion.div
        className="rounded-lg bg-slate-900/40 w-full h-full overflow-visible"
        style={{ border: `1px solid ${brandColor}80` }}
        animate={{ opacity: dimmed ? 0.5 : 1 }}
        transition={{ duration: 0.5 }}
      >
        {_editMode && (
          <NodeResizer
            minWidth={200}
            minHeight={120}
            handleStyle={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(245 158 11 / 0.7)', border: '1px solid rgb(245 158 11)' }}
            lineStyle={{ borderColor: 'rgb(245 158 11 / 0.3)' }}
          />
        )}
        <div
          className="px-3 py-1.5 flex items-center justify-between"
          style={{ backgroundColor: `${brandColor}15` }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandColor }} />
            <span className="text-xs font-mono font-semibold tracking-wider" style={{ color: brandColor }}>
              {chainName}
            </span>
          </div>
          {chainId && (
            <span className="text-[11px] font-mono text-slate-500">{chainId}</span>
          )}
        </div>

        <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
        <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
      </motion.div>
    )
  }

  return (
    <motion.div
      className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 min-w-[200px] min-h-[120px]"
      style={{ borderLeftWidth: 4, borderLeftColor: brandColor }}
      animate={{ opacity: dimmed ? 0.5 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {_editMode && (
        <NodeResizer
          minWidth={150}
          minHeight={80}
          handleStyle={{ width: 8, height: 8, borderRadius: '50%', background: 'rgb(245 158 11 / 0.7)', border: '1px solid rgb(245 158 11)' }}
          lineStyle={{ borderColor: 'rgb(245 158 11 / 0.3)' }}
        />
      )}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: brandColor }} />
        <span className={`text-xs font-mono uppercase tracking-wider ${
          state === 'active' ? 'text-slate-200' : 'text-slate-500'
        }`}>
          {chainName}
        </span>
      </div>

      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
