import { useEffect, useRef, useState } from 'react'
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { EdgeState } from '../types'

export interface OnChainEdgeData {
  state?: EdgeState
  label?: string
  labelOffsetX?: number
  labelOffsetY?: number
  [key: string]: unknown
}

export default function OnChainEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as OnChainEdgeData | undefined
  const state = edgeData?.state ?? 'idle'

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const pathRef = useRef<SVGPathElement>(null)
  const [totalLength, setTotalLength] = useState(300)

  useEffect(() => {
    if (pathRef.current) {
      setTotalLength(pathRef.current.getTotalLength())
    }
  }, [path])

  return (
    <>
      <g>
        {/* Draw-on effect via strokeDashoffset */}
        <motion.path
          ref={pathRef}
          d={path}
          stroke="var(--slate-500, #64748b)"
          strokeWidth={2}
          strokeDasharray={`${totalLength}`}
          fill="none"
          initial={{ strokeDashoffset: totalLength }}
          animate={{ strokeDashoffset: state !== 'idle' ? 0 : totalLength }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
        />

        {/* After draw-on, swap to dashed completed style */}
        {state === 'completed' && (
          <path
            d={path}
            stroke="var(--positive-500, #10b981)"
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="none"
          />
        )}

        {/* Confirmation pulse at target */}
        {state === 'completed' && (
          <motion.circle
            cx={targetX}
            cy={targetY}
            r={6}
            fill="var(--positive-500, #10b981)"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.3, 1] }}
            transition={{ type: 'spring', stiffness: 200 }}
          />
        )}
      </g>

      {/* Label pill – rendered in HTML layer via EdgeLabelRenderer to sit above container nodes */}
      {edgeData?.label && state !== 'idle' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX + (edgeData?.labelOffsetX ?? 0)}px,${labelY + (edgeData?.labelOffsetY ?? 0)}px)`,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            <span className="bg-surface-800 border border-slate-700 text-[11px] font-mono text-slate-400 px-1.5 py-0.5 rounded whitespace-nowrap">
              {edgeData.label}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
