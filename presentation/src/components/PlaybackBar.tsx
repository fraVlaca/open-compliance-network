import { useEffect } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { usePlayback } from '../context/PlaybackContext'
import { usePrezi, useDrillDownControls } from '../context/PreziContext'
import { STAGES } from '../types'
import type { PlaybackSpeed } from '../types'

const speeds: PlaybackSpeed[] = [0.5, 1, 2]

// Drillable stage IDs (exclude overview and summary from the dots)
const DRILLABLE_STAGES = STAGES.filter(s => s.id !== 'overview')

export default function PlaybackBar() {
  const outer = usePlayback()
  const prezi = usePrezi()
  const { controls: dc } = useDrillDownControls()

  // Determine whether we're in a drill-down with controls available
  const inDrillDown = prezi.phase === 'drill-down' && dc != null

  // Effective playback state – inner drill-down takes priority
  const playing = inDrillDown ? dc!.state.playing : outer.state.playing
  const speed = inDrillDown ? dc!.state.speed : outer.state.speed
  const currentStep = inDrillDown
    ? dc!.state.flowState.currentStep
    : outer.state.flowState.currentStep
  const activeStageId = inDrillDown ? prezi.drillDownStage : outer.state.flowState.currentStage

  // Transport actions – delegate to the right provider
  const doPlay = () => { inDrillDown ? dc!.play() : outer.play() }
  const doPause = () => { inDrillDown ? dc!.pause() : outer.pause() }
  const doStepForward = () => { inDrillDown ? dc!.stepForward() : outer.stepForward() }
  const doStepBackward = () => { inDrillDown ? dc!.stepBackward() : outer.stepBackward() }
  const doSetSpeed = (s: PlaybackSpeed) => {
    // Set speed on both providers so they stay in sync
    outer.setSpeed(s)
    if (dc) dc.setSpeed(s)
  }

  const doReset = () => {
    if (inDrillDown) {
      prezi.exitDrillDown()
    }
    outer.reset()
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          playing ? doPause() : doPlay()
          break
        case 'r':
        case 'R':
          doReset()
          break
        case 'ArrowRight':
          e.preventDefault()
          doStepForward()
          break
        case 'ArrowLeft':
          e.preventDefault()
          doStepBackward()
          break
        case '1':
          doSetSpeed(0.5)
          break
        case '2':
          doSetSpeed(1)
          break
        case '3':
          doSetSpeed(2)
          break
        case 'Escape':
          if (inDrillDown) {
            prezi.exitDrillDown()
          } else {
            outer.goToStage('overview')
          }
          break
      }
    }

    // Use capture phase so shortcuts fire before React Flow's stopPropagation
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  })

  // For determining "past" dots: use the overview's node states
  const overviewNodeStates = outer.state.flowState.nodeStates

  return (
    <div className="flex items-center justify-between px-6 py-2.5 border-t border-slate-800 bg-surface-900/95 backdrop-blur-sm">
      {/* Left: Transport controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => { playing ? doPause() : doPlay() }}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
          title={playing ? 'Pause (Space)' : 'Play (Space)'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button
          onClick={doReset}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          title="Reset (R)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-5 bg-slate-800 mx-1" />
        <button
          onClick={doStepBackward}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          title="Step Back (←)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={doStepForward}
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          title="Step Forward (→)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Stage dots (no Overview) */}
      <div className="flex items-center gap-2">
        {DRILLABLE_STAGES.map((stage) => {
          const isActive = stage.id === activeStageId
          const isPast = overviewNodeStates[stage.id] === 'completed'
          const isDrillable = stage.id !== 'summary'

          return (
            <button
              key={stage.id}
              onClick={() => {
                if (isDrillable) {
                  prezi.goToDrillDown(stage.id, false)
                } else {
                  if (inDrillDown) prezi.exitDrillDown()
                  outer.goToStage(stage.id)
                }
              }}
              className="flex flex-col items-center gap-1 group"
              title={stage.label}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-primary-500 ring-2 ring-primary-500/30 scale-125'
                    : isPast
                      ? 'bg-positive-500'
                      : 'bg-slate-700 group-hover:bg-slate-600'
                }`}
              />
              <span className={`text-[9px] font-mono ${
                isActive ? 'text-primary-400' : isPast ? 'text-slate-500' : 'text-slate-700'
              }`}>
                {stage.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Right: Speed + step counter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-0.5 bg-slate-800/50 rounded p-0.5">
          {speeds.map(s => (
            <button
              key={s}
              onClick={() => doSetSpeed(s)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                speed === s
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <span className="text-xs font-mono text-slate-600 w-16 text-right">
          step {currentStep + 1}
        </span>
      </div>
    </div>
  )
}
