import { AnimatePresence, motion } from 'motion/react'
import type { SidePanelData } from '../types'

interface JsonSidePanelProps {
  data: SidePanelData | null
}

export default function JsonSidePanel({ data }: JsonSidePanelProps) {
  return (
    <AnimatePresence mode="wait">
      {data && (
        <motion.div
          key={data.title}
          className="fixed right-0 top-0 h-full w-[360px] bg-surface-900 border-l border-slate-800 p-4 overflow-y-auto z-20"
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="text-[10px] text-slate-600 mb-0.5 font-mono uppercase tracking-wider">
            {data.stage} · {data.beat}
          </div>
          <div className="text-sm font-medium text-slate-300 mb-3">{data.title}</div>
          <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
            {renderJson(data.json, data.highlightFields)}
          </pre>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function renderJson(
  json: unknown,
  highlights: string[],
  currentPath = '',
  depth = 0
): React.ReactNode {
  if (json === null || json === undefined) {
    return <span className="text-slate-500">null</span>
  }

  if (Array.isArray(json)) {
    if (json.length === 0) return <span className="text-slate-500">[]</span>
    return (
      <span>
        {'[\n'}
        {json.map((item, i) => (
          <span key={i}>
            {indent(depth + 1)}
            {renderJson(item, highlights, `${currentPath}[${i}]`, depth + 1)}
            {i < json.length - 1 ? ',' : ''}
            {'\n'}
          </span>
        ))}
        {indent(depth)}{']'}
      </span>
    )
  }

  if (typeof json === 'object') {
    const entries = Object.entries(json as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-slate-500">{'{}'}</span>
    return (
      <span>
        {'{\n'}
        {entries.map(([key, value], i) => {
          const path = currentPath ? `${currentPath}.${key}` : key
          const isHighlighted = highlights.some(h => path.startsWith(h) || h.startsWith(path))

          return (
            <span key={key}>
              <span className={isHighlighted ? 'bg-primary-500/10 inline' : ''}>
                {indent(depth + 1)}
                <span className={isHighlighted ? 'text-primary-300 font-medium' : 'text-primary-400'}>
                  "{key}"
                </span>
                <span className="text-slate-600">: </span>
                {typeof value === 'object' && value !== null
                  ? renderJson(value, highlights, path, depth + 1)
                  : renderPrimitive(value)
                }
              </span>
              {i < entries.length - 1 ? ',' : ''}
              {'\n'}
            </span>
          )
        })}
        {indent(depth)}{'}'}
      </span>
    )
  }

  return renderPrimitive(json)
}

function renderPrimitive(value: unknown): React.ReactNode {
  if (typeof value === 'string') {
    return <span className="text-slate-300">"{value}"</span>
  }
  if (typeof value === 'number') {
    return <span className="text-warning-400">{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span className="text-positive-400">{String(value)}</span>
  }
  return <span className="text-slate-500">{JSON.stringify(value)}</span>
}

function indent(depth: number): string {
  return '  '.repeat(depth)
}
