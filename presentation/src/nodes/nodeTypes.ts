import StageNode from './StageNode'
import WorkflowNode from './WorkflowNode'
import ProviderNode from './ProviderNode'
import ActorNode from './ActorNode'
import ContractNode from './ContractNode'
import RegistryNode from './RegistryNode'
import IpfsNode from './IpfsNode'
import RuleEngineNode from './RuleEngineNode'
import CodeNode from './CodeNode'
import ProblemStepNode from './ProblemStepNode'
import ComparisonNode from './ComparisonNode'
import ChainNode from './ChainNode'
import CreEnclaveNode from './CreEnclaveNode'

export const nodeTypes = {
  stageNode: StageNode,
  workflowNode: WorkflowNode,
  providerNode: ProviderNode,
  actorNode: ActorNode,
  contractNode: ContractNode,
  registryNode: RegistryNode,
  ipfsNode: IpfsNode,
  ruleEngineNode: RuleEngineNode,
  codeNode: CodeNode,
  problemStepNode: ProblemStepNode,
  comparisonNode: ComparisonNode,
  chainNode: ChainNode,
  creEnclaveNode: CreEnclaveNode,
}
