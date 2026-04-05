// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockKeystoneForwarder — accepts reports without DON signature verification
/// @notice For simulation/demo only. In production, the real KeystoneForwarder
///         verifies DON threshold signatures before forwarding.
///
/// CRE simulation rawReport layout (525 bytes total):
///   [0:1]   version byte (0x01)
///   [1:33]  transmissionId / workflowCid (32 bytes)
///   [33:37] donId (4 bytes)
///   [37:41] executionState (4 bytes)
///   [41:45] flags (4 bytes)
///   [45:77] padding (32 bytes)
///   [77:87] workflowName (10 bytes)
///   [87:107] workflowOwner (20 bytes — but filled with 0xaa in simulation)
///   [107:109] reportName (2 bytes)
///   [109:] ABI-encoded report payload
///
/// Our consumer expects onReport(metadata, report) where:
///   metadata: [32 workflowCid][10 workflowName][20 workflowOwner][2 reportName] = 64 bytes
///   report: ABI-encoded payload
contract MockForwarder {
    event ReportForwarded(address indexed receiver, bool success);

    function report(
        address receiverAddress,
        bytes calldata rawReport,
        bytes calldata,
        bytes[] calldata
    ) external {
        require(rawReport.length > 109, "rawReport too short");

        // Extract metadata fields from rawReport
        bytes32 workflowCid = bytes32(rawReport[1:33]);
        bytes10 workflowName = bytes10(rawReport[77:87]);
        bytes20 workflowOwner = bytes20(rawReport[87:107]);
        bytes2 reportName = bytes2(rawReport[107:109]);

        // Pack metadata in the format the consumer expects
        bytes memory metadata = abi.encodePacked(workflowCid, workflowName, workflowOwner, reportName);

        // Extract the ABI-encoded report payload
        bytes memory reportPayload = rawReport[109:];

        (bool success, ) = receiverAddress.call(
            abi.encodeWithSignature("onReport(bytes,bytes)", metadata, reportPayload)
        );
        emit ReportForwarded(receiverAddress, success);
    }
}
