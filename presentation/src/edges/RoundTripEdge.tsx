import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { EdgeState } from '../types'

export interface RoundTripEdgeData {
  requestState?: EdgeState
  responseState?: EdgeState
  requestLabel?: string
  responseLabel?: string
  variant?: 'default' | 'confidential'
  [key: string]: unknown
}

const OFFSET = 5

// Colors per variant
const COLORS = {
  default: { stroke: 'var(--primary-500, #3b82f6)', dot: 'var(--primary-500, #3b82f6)', border: 'border-slate-700', text: 'text-slate-400' },
  confidential: { stroke: '#8b5cf6', dot: '#8b5cf6', border: 'border-tee-700/50', text: 'text-tee-400' },
}

export default function RoundTripEdge({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const edgeData = data as RoundTripEdgeData | undefined
  const reqState = edgeData?.requestState ?? 'idle'
  const resState = edgeData?.responseState ?? 'idle'
  const variant = edgeData?.variant ?? 'default'
  const colors = COLORS[variant]

  // Two parallel bezier paths offset ±OFFSET from center
  const [requestPath, reqLabelX, reqLabelY] = getBezierPath({
    sourceX, sourceY: sourceY - OFFSET, targetX, targetY: targetY - OFFSET,
    sourcePosition, targetPosition,
  })
  const [responsePath, resLabelX, resLabelY] = getBezierPath({
    sourceX, sourceY: sourceY + OFFSET, targetX, targetY: targetY + OFFSET,
    sourcePosition, targetPosition,
  })

  const reqStroke =
    reqState === 'completed' ? 'var(--positive-500, #10b981)' :
    reqState === 'active' ? colors.stroke :
    'var(--slate-600, #475569)'

  const resStroke =
    resState === 'completed' ? 'var(--positive-500, #10b981)' :
    resState === 'active' ? '#10b981' :
    'var(--slate-600, #475569)'

  return (
    <>
      <g>
        {/* Request path (top) — forward dot */}
        <path
          d={requestPath}
          stroke={reqStroke}
          strokeWidth={1.5}
          strokeDasharray="6 4"
          fill="none"
          opacity={reqState === 'idle' ? 0.3 : 1}
        />
        {reqState === 'active' && (
          <motion.circle
            r={3}
            fill={colors.dot}
            initial={{ offsetDistance: '0%' }}
            animate={{ offsetDistance: '100%' }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            style={{ offsetPath: `path('${requestPath}')` }}
          />
        )}

        {/* Response path (bottom) — green, reverse dot */}
        <path
          d={responsePath}
          stroke={resStroke}
          strokeWidth={1.5}
          strokeDasharray="4 6"
          fill="none"
          opacity={resState === 'idle' ? 0.3 : 1}
        />
        {resState === 'active' && (
          <motion.circle
            r={3}
            fill="#10b981"
            initial={{ offsetDistance: '100%' }}
            animate={{ offsetDistance: '0%' }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
            style={{ offsetPath: `path('${responsePath}')` }}
          />
        )}
      </g>

      {/* Request label (above top path) */}
      {edgeData?.requestLabel && reqState !== 'idle' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${reqLabelX}px,${reqLabelY - 12}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span className={`bg-surface-800 border ${colors.border} text-[10px] font-mono ${colors.text} px-1.5 py-0.5 rounded whitespace-nowrap`}>
              {edgeData.requestLabel}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Response label (below bottom path) */}
      {edgeData?.responseLabel && resState !== 'idle' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${resLabelX}px,${resLabelY + 12}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span className="bg-surface-800 border border-positive-700/50 text-[10px] font-mono text-positive-400 px-1.5 py-0.5 rounded whitespace-nowrap">
              {edgeData.responseLabel}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
