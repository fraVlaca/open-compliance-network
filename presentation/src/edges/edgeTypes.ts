import DataFlowEdge from './DataFlowEdge'
import OnChainEdge from './OnChainEdge'
import ConfidentialEdge from './ConfidentialEdge'
import CallbackEdge from './CallbackEdge'
import RoundTripEdge from './RoundTripEdge'

export const edgeTypes = {
  dataFlowEdge: DataFlowEdge,
  onChainEdge: OnChainEdge,
  confidentialEdge: ConfidentialEdge,
  callbackEdge: CallbackEdge,
  roundTripEdge: RoundTripEdge,
}
