import { useEffect } from 'react'
import { motion } from 'motion/react'
import { usePlayback } from '../context/PlaybackContext'
import { DEMO } from '../constants'
import type { StageSequence, FlowState } from '../types'

const summaryPanel = {
  stage: 'Summary', beat: 'Deployed', title: 'Arc Testnet Contracts',
  json: DEMO.contracts,
  highlightFields: ['credentialConsumer', 'reportConsumer', 'escrowSwap'],
}

function buildSummarySequence(): StageSequence {
  return [
    { delay: 200, sidePanel: summaryPanel, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, summary: 'active' } }) },
    { delay: 3000, apply: (s: FlowState) => ({ nodeStates: { ...s.nodeStates, summary: 'completed' } }) },
  ]
}

const contracts = Object.entries(DEMO.contracts)

export default function SummaryStage() {
  const { registerSequence } = usePlayback()

  useEffect(() => { registerSequence('summary', buildSummarySequence()) }, [registerSequence])

  return (
    <div className="w-full h-full flex items-center justify-center px-12">
      <div className="max-w-3xl w-full">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center mb-10">
          <div className="text-3xl font-bold text-slate-100 mb-3">Open Compliance Layer</div>
          <div className="text-lg text-primary-400 font-mono">{DEMO.tagline}</div>
        </motion.div>

        {/* Key metrics */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.6 }} className="grid grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Integration', value: '1 line', sub: 'require(isVerified(wallet))' },
            { label: 'Compliance Providers', value: '2+1', sub: 'Sumsub + Chainalysis (Notabene planned)' },
            { label: 'Trust Model', value: '21 nodes', sub: 'BFT consensus + CRE enclave' },
            { label: 'Protocol PII', value: 'Zero', sub: 'Never held, never processed' },
          ].map((metric, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.2 }}
              className="border border-slate-700 rounded-lg p-4 text-center bg-surface-800"
            >
              <div className="text-2xl font-bold text-primary-400">{metric.value}</div>
              <div className="text-sm text-slate-300 font-medium mt-1">{metric.label}</div>
              <div className="text-[10px] text-slate-500 mt-1 font-mono">{metric.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Deployed contracts */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 0.6 }}>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 text-center">Deployed on Arc Testnet (Circle) - Chain ID 5042002 - USDC-native gas</div>
          <div className="grid grid-cols-2 gap-2">
            {contracts.map(([name, address], i) => (
              <motion.div key={name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 + i * 0.1 }}
                className="flex items-center justify-between px-3 py-1.5 border border-slate-800 rounded bg-surface-900"
              >
                <span className="text-[11px] text-slate-400">{name}</span>
                <span className="text-[10px] text-slate-600 font-mono">{address.slice(0, 8)}...{address.slice(-4)}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4, duration: 0.6 }} className="mt-8 text-center space-y-2">
          <div className="text-sm text-slate-400">
            Protocols read compliance like a Chainlink price feed.
          </div>
          <div className="text-sm text-slate-400">
            They never touch PII. They never run KYC infrastructure. They never become regulated entities.
          </div>
          <div className="text-lg text-positive-400 font-semibold mt-3">
            They just call isVerified().
          </div>
          <div className="text-[10px] text-slate-600 mt-6 pt-4 border-t border-slate-800">
            Built at ETHGlobal Cannes 2026 &middot; Chainlink CRE + ACE &middot; Arc (Circle) &middot; Sumsub + Chainalysis
          </div>
        </motion.div>
      </div>
    </div>
  )
}
