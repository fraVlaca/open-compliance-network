/**
 * Simulation hooks for hackathon demo.
 * When SIMULATE_MODE is true, these bypass CRE and call onReport() directly
 * on the consumer contracts to issue credentials and compliance reports.
 *
 * The keystoneForwarder on both consumers was set to the deployer wallet,
 * so the connected wallet (deployer) can call onReport() directly.
 */
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import {
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
  toHex,
  pad,
  type Address,
  type Hex,
  concat,
} from "viem";
import {
  CONTRACTS,
  CREDENTIAL_CONSUMER_SIMULATE_ABI,
  REPORT_CONSUMER_SIMULATE_ABI,
} from "../config/contracts";

const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

/**
 * Build the metadata bytes that KeystoneForwarder would normally provide.
 * Layout: [32 bytes workflowCid][10 bytes workflowName][20 bytes workflowOwner][2 bytes reportName]
 */
function buildMetadata(workflowOwner: Address): Hex {
  const workflowCid = ZERO_BYTES32; // skip validation (expectedWorkflowId = 0x0)
  const workflowName = pad(toHex("demo-wf"), { size: 10, dir: "right" });
  const ownerBytes = workflowOwner.toLowerCase() as Hex;
  const reportName = "0x0001" as Hex;
  return concat([workflowCid, workflowName, ownerBytes, reportName]);
}

/**
 * Build the credential report payload for ComplianceCredentialConsumer.onReport()
 * This simulates what CRE Workflow A would produce.
 */
export function buildCredentialReport(
  walletAddress: Address,
  brokerAppId: Hex = ZERO_BYTES32,
  workspaceId: Hex = ZERO_BYTES32
): Hex {
  const ccid = keccak256(
    encodePacked(["string", "address"], ["compliance-v1", walletAddress])
  );
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year

  const credentialData = encodeAbiParameters(
    parseAbiParameters("uint8, uint8, string, bytes32, bytes32"),
    [2, 1, "US", brokerAppId, workspaceId] // kycLevel=2, riskScore=1, jurisdiction=US
  );

  return encodeAbiParameters(
    parseAbiParameters("address, bytes32, bytes32, uint40, bytes"),
    [walletAddress, ccid, KYC_VERIFIED, expiresAt, credentialData]
  );
}

/**
 * Build the compliance report payload for ComplianceReportConsumer.onReport()
 * This simulates what CRE Workflow B would produce.
 */
export function buildComplianceReport(
  tradeId: Hex,
  trader: Address,
  counterparty: Address,
  sourceContract: Address,
  approved: boolean
): Hex {
  const auditHash = keccak256(toHex(JSON.stringify({ tradeId, approved, ts: Date.now() })));
  const timestamp = BigInt(Math.floor(Date.now() / 1000));

  return encodeAbiParameters(
    parseAbiParameters(
      "(bytes32, address, address, address, bool, uint8, bytes32, string, uint256)"
    ),
    [
      {
        0: tradeId,
        1: trader,
        2: counterparty,
        3: sourceContract,
        4: approved,
        5: approved ? 1 : 8,
        6: auditHash,
        7: "", // ipfsCid — empty for simulation
        8: timestamp,
      },
    ] as any
  );
}

/**
 * Hook to simulate KYC credential issuance (Workflow A)
 */
export function useSimulateCredentialIssuance() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const issueCredential = (walletAddress: Address, callerAddress: Address) => {
    const metadata = buildMetadata(callerAddress);
    const report = buildCredentialReport(walletAddress);

    writeContract({
      address: CONTRACTS.credentialConsumer,
      abi: CREDENTIAL_CONSUMER_SIMULATE_ABI,
      functionName: "onReport",
      args: [metadata, report],
    });
  };

  return { issueCredential, hash, isPending, isConfirming, isSuccess, error };
}

/**
 * Hook to simulate per-trade compliance report (Workflow B)
 */
export function useSimulateComplianceReport() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const issueReport = (
    tradeId: Hex,
    trader: Address,
    counterparty: Address,
    sourceContract: Address,
    approved: boolean,
    callerAddress: Address
  ) => {
    const metadata = buildMetadata(callerAddress);
    const report = buildComplianceReport(tradeId, trader, counterparty, sourceContract, approved);

    writeContract({
      address: CONTRACTS.reportConsumer,
      abi: REPORT_CONSUMER_SIMULATE_ABI,
      functionName: "onReport",
      args: [metadata, report],
    });
  };

  return { issueReport, hash, isPending, isConfirming, isSuccess, error };
}
