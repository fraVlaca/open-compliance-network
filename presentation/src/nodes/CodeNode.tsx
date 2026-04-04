import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { Code } from 'lucide-react'
import type { NodeState } from '../types'

export interface CodeNodeData {
  title: string
  code: string
  language?: string
  state: NodeState
  [key: string]: unknown
}

export default function CodeNode({ data }: NodeProps) {
  const { title, code, language, state } = data as unknown as CodeNodeData

  const borderColor =
    state === 'completed' ? 'border-positive-500' :
    state === 'active' ? 'border-chain-500' :
    'border-slate-700'

  const lines = code.split('\n')

  return (
    <motion.div
      className={`rounded-lg border-2 bg-surface-900 px-4 py-3 min-w-[200px] max-w-[400px] ${borderColor}`}
      animate={state === 'active' ? {
        boxShadow: ['0 0 4px rgba(6,182,212,0.2)', '0 0 12px rgba(6,182,212,0.3)', '0 0 4px rgba(6,182,212,0.2)'],
      } : { boxShadow: '0 0 0px rgba(6,182,212,0)' }}
      transition={state === 'active' ? { duration: 2, repeat: Infinity } : { duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Code className={`w-3.5 h-3.5 ${state === 'active' ? 'text-chain-400' : 'text-slate-500'}`} />
        <span className={`text-xs font-semibold ${
          state === 'active' ? 'text-chain-300' : state === 'completed' ? 'text-positive-400' : 'text-slate-400'
        }`}>{title}</span>
        {language && <span className="text-[9px] text-slate-600 ml-auto">{language}</span>}
      </div>

      <pre className="text-[10px] leading-relaxed overflow-hidden">
        {lines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: state === 'idle' ? 0.3 : 1 }}
            animate={{ opacity: state === 'idle' ? 0.3 : 1 }}
            transition={{ delay: state === 'active' ? i * 0.08 : 0 }}
            className="whitespace-pre"
          >
            <span className={highlightSolidity(line, state)} >{line || ' '}</span>
          </motion.div>
        ))}
      </pre>

      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </motion.div>
  )
}

function highlightSolidity(line: string, state: NodeState): string {
  if (state === 'idle') return 'text-slate-600'
  if (line.trim().startsWith('//')) return 'text-slate-500 italic'
  if (line.includes('require') || line.includes('revert')) return 'text-warning-400'
  if (line.includes('function') || line.includes('external') || line.includes('modifier')) return 'text-tee-400'
  if (line.includes('emit')) return 'text-chain-400'
  return 'text-slate-300'
}
