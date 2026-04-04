import { useEffect, useRef } from 'react'
import { Toaster } from 'sonner'
import { PlaybackProvider, usePlayback } from './context/PlaybackContext'
import { LayoutEditorProvider, useLayoutEditor } from './context/LayoutEditorContext'
import { PreziProvider, usePrezi } from './context/PreziContext'
import StageRouter from './components/StageRouter'
import DrillDownOverlay from './components/DrillDownOverlay'
import PlaybackBar from './components/PlaybackBar'
import LayoutEditorToolbar from './components/LayoutEditorToolbar'
import OverviewStage from './stages/OverviewStage'
import ProblemDrillDown from './stages/ProblemDrillDown'
import GapDrillDown from './stages/GapDrillDown'
import KycFlowDrillDown from './stages/KycFlowDrillDown'
import TradeFlowDrillDown from './stages/TradeFlowDrillDown'
import AuditDrillDown from './stages/AuditDrillDown'
import IntegrationDrillDown from './stages/IntegrationDrillDown'
import SummaryStage from './stages/SummaryStage'

const stageComponents: Record<string, React.ComponentType> = {
  overview: OverviewStage,
  problem: ProblemDrillDown,
  gap: GapDrillDown,
  kyc: KycFlowDrillDown,
  trade: TradeFlowDrillDown,
  audit: AuditDrillDown,
  integration: IntegrationDrillDown,
  summary: SummaryStage,
}

const drillDownComponents: Record<string, React.ComponentType> = {
  problem: ProblemDrillDown,
  gap: GapDrillDown,
  kyc: KycFlowDrillDown,
  trade: TradeFlowDrillDown,
  audit: AuditDrillDown,
  integration: IntegrationDrillDown,
}

export default function PresentationApp({
  autoPlay = false,
  hideHeader = false,
  hidePlaybackBar = false,
}: {
  autoPlay?: boolean
  hideHeader?: boolean
  hidePlaybackBar?: boolean
}) {
  return (
    <PlaybackProvider autoPlay={autoPlay}>
      <LayoutEditorProvider>
        <PreziProvider>
          <PresentationLayout hideHeader={hideHeader} hidePlaybackBar={hidePlaybackBar} />
        </PreziProvider>
        <Toaster position="bottom-center" theme="dark" />
      </LayoutEditorProvider>
    </PlaybackProvider>
  )
}

function PresentationLayout({ hideHeader = false, hidePlaybackBar = false }: { hideHeader?: boolean; hidePlaybackBar?: boolean }) {
  const { editMode } = useLayoutEditor()
  const { state, play } = usePlayback()
  const { enabled: preziEnabled, phase } = usePrezi()
  const startedRef = useRef(false)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'autoplay' && e.data?.action === 'start' && !startedRef.current) {
        startedRef.current = true
        play()
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [play])

  const usePreziMode = preziEnabled && (
    state.flowState.currentStage === 'overview' || phase !== 'idle'
  )

  return (
    <div className="h-screen w-screen bg-surface-900 text-slate-200 overflow-hidden flex flex-col">
      {/* Header */}
      {!hideHeader && (
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-primary-400 tracking-wide">OPEN COMPLIANCE LAYER</span>
          <span className="text-xs text-slate-500">|</span>
          <span className="text-sm text-slate-400">Architecture Presentation</span>
        </div>
        <div className="flex items-center gap-4">
          <LayoutEditorToolbar />
          <span className="text-xs text-slate-700">|</span>
          <span className="text-[10px] text-slate-600 font-mono">
            Trustless Compliance Engine for Institutional DeFi
          </span>
          <span className="text-xs text-slate-700">|</span>
          <span className="text-[10px] text-slate-700 font-mono">Deployed on Arc (Circle)</span>
        </div>
      </div>
      )}

      {/* Main canvas area */}
      <div className={`flex-1 relative overflow-hidden ${editMode ? 'ring-2 ring-amber-500/30 ring-inset' : ''}`}>
        {usePreziMode ? (
          <>
            <div className="w-full h-full">
              <OverviewStage />
            </div>
            <DrillDownOverlay stageComponents={drillDownComponents} />
          </>
        ) : (
          <StageRouter stages={stageComponents} />
        )}
      </div>

      {/* Playback bar */}
      {!hidePlaybackBar && <PlaybackBar />}
    </div>
  )
}
