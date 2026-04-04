import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { EdgeState } from '../types'

export interface CallbackEdgeData {
  state?: EdgeState
  label?: string
  [key: string]: unknown
}

export default function CallbackEdge({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const edgeData = data as CallbackEdgeData | undefined
  const state = edgeData?.state ?? 'idle'

  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  const strokeColor =
    state === 'completed' ? 'var(--positive-500, #10b981)' :
    state === 'active' ? '#10b981' :
    'var(--slate-600, #475569)'

  return (
    <>
      <g>
        {/* Green dashed line */}
        <path
          d={path}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeDasharray="4 6"
          fill="none"
          opacity={state === 'idle' ? 0.3 : 1}
        />

        {/* Reverse-direction flowing dot (green) */}
        {state === 'active' && (
          <motion.circle
            r={3}
            fill="#10b981"
            initial={{ offsetDistance: '100%' }}
            animate={{ offsetDistance: '0%' }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            style={{ offsetPath: `path('${path}')` }}
          />
        )}

        {/* Arrow at the "target" end (reverse direction visual) */}
        {state !== 'idle' && (
          <marker id="callback-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
          </marker>
        )}
      </g>

      {edgeData?.label && state !== 'idle' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span className="bg-surface-800 border border-positive-700/50 text-[10px] font-mono text-positive-400 px-1.5 py-0.5 rounded whitespace-nowrap">
              {edgeData.label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
