import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { EdgeState } from '../types'

export interface RestEdgeData {
  state?: EdgeState
  label?: string
  labelOffsetY?: number
  [key: string]: unknown
}

export default function RestEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as RestEdgeData | undefined
  const state = edgeData?.state ?? 'idle'

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const strokeColor =
    state === 'completed' ? 'var(--positive-500, #10b981)' :
    state === 'active' ? 'var(--primary-500, #3b82f6)' :
    'var(--slate-600, #475569)'

  const offsetY = edgeData?.labelOffsetY ?? 0

  return (
    <>
      <g>
        {/* Dashed line */}
        <path
          d={path}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          fill="none"
        />

        {/* One-shot flowing dot */}
        {state === 'active' && (
          <motion.circle
            r={3}
            fill="var(--primary-500, #3b82f6)"
            initial={{ offsetDistance: '0%' }}
            animate={{ offsetDistance: '100%' }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            style={{ offsetPath: `path('${path}')` }}
          />
        )}
      </g>

      {/* Label pill – rendered in HTML layer via EdgeLabelRenderer */}
      {edgeData?.label && state !== 'idle' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + offsetY}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span className="bg-surface-800 border border-slate-700 text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded whitespace-nowrap">
              {edgeData.label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
