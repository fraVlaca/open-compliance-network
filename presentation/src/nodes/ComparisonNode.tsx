import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { NodeState } from '../types'

export interface ComparisonNodeData {
  title: string
  columns: string[]
  rows: string[][]
  highlightRow?: number
  state: NodeState
  [key: string]: unknown
}

export default function ComparisonNode({ data }: NodeProps) {
  const { title, columns, rows, highlightRow, state } = data as unknown as ComparisonNodeData

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? 'border-primary-500' :
    'border-slate-700'

  return (
    <motion.div
      className={`rounded-lg border-2 bg-surface-800 px-3 py-3 ${borderColor}`}
      animate={state === 'active' ? {
        boxShadow: ['0 0 4px rgba(59,130,246,0.15)', '0 0 10px rgba(59,130,246,0.25)', '0 0 4px rgba(59,130,246,0.15)'],
      } : { boxShadow: '0 0 0px rgba(59,130,246,0)' }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="text-xs font-semibold text-slate-300 mb-2">{title}</div>

      <table className="text-[10px] w-full">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} className="text-left text-slate-500 font-medium pb-1 pr-3">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <motion.tr
              key={ri}
              initial={{ opacity: 0 }}
              animate={{ opacity: state === 'idle' ? 0.3 : 1 }}
              transition={{ delay: state === 'active' ? ri * 0.12 : 0 }}
              className={ri === highlightRow ? 'bg-primary-500/10' : ''}
            >
              {row.map((cell, ci) => (
                <td key={ci} className={`py-0.5 pr-3 ${
                  ci === 0 ? 'text-slate-400 font-medium' :
                  cell === 'Yes' || cell === 'true' ? 'text-positive-400' :
                  cell === 'No' || cell === 'false' ? 'text-negative-400' :
                  cell.includes('$') ? 'text-warning-400' :
                  'text-slate-400'
                }`}>{cell}</td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>

      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}
