import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { EdgeState } from '../types'

export interface ConfidentialEdgeData {
  state?: EdgeState
  label?: string
  [key: string]: unknown
}

export default function ConfidentialEdge({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const edgeData = data as ConfidentialEdgeData | undefined
  const state = edgeData?.state ?? 'idle'

  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  const strokeColor =
    state === 'completed' ? 'var(--positive-500, #10b981)' :
    state === 'active' ? '#8b5cf6' :
    'var(--slate-600, #475569)'

  // Lock icon midpoint
  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  return (
    <>
      <g>
        {/* Purple dashed line */}
        <path
          d={path}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          fill="none"
          opacity={state === 'idle' ? 0.4 : 1}
        />

        {/* Flowing dot (purple) */}
        {state === 'active' && (
          <motion.circle
            r={3}
            fill="#8b5cf6"
            initial={{ offsetDistance: '0%' }}
            animate={{ offsetDistance: '100%' }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            style={{ offsetPath: `path('${path}')` }}
          />
        )}

        {/* Lock icon at midpoint */}
        {state !== 'idle' && (
          <g transform={`translate(${midX - 6}, ${midY - 7})`}>
            <rect x="1" y="5" width="10" height="8" rx="1" fill="none" stroke="#8b5cf6" strokeWidth="1.2" />
            <path d="M3 5V3.5a3 3 0 0 1 6 0V5" fill="none" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round" />
          </g>
        )}
      </g>

      {edgeData?.label && state !== 'idle' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 14}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span className="bg-surface-800 border border-tee-700/50 text-[10px] font-mono text-tee-400 px-1.5 py-0.5 rounded whitespace-nowrap">
              {edgeData.label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
