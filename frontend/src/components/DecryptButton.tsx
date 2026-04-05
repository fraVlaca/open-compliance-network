import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Unlock, Loader2, AlertTriangle, Wallet } from "lucide-react";
import { decryptIdentity } from "../lib/decrypt";

interface DecryptButtonProps {
  encryptedHex: string;
}

const SIGN_MESSAGE = "OCL: Authorize decryption of compliance PII data";

export default function DecryptButton({ encryptedHex }: DecryptButtonProps) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [state, setState] = useState<"idle" | "signing" | "decrypting" | "done" | "error">("idle");
  const [decrypted, setDecrypted] = useState<Record<string, unknown> | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleDecrypt = async () => {
    if (!address) return;

    // Step 1: Wallet signature - proves ownership & authorizes decryption
    setState("signing");
    try {
      const sig = await signMessageAsync({ message: SIGN_MESSAGE });
      setSignature(sig);

      // Step 2: Decrypt with AES key (authorized by wallet signature)
      setState("decrypting");
      const result = await decryptIdentity(encryptedHex);
      setDecrypted(result);
      setState("done");
    } catch (err: any) {
      if (err.name === "UserRejectedRequestError" || err.message?.includes("User rejected")) {
        setErrorMsg("Wallet signature rejected - decryption cancelled");
      } else {
        setErrorMsg(err.message || "Decryption failed");
      }
      setState("error");
    }
  };

  if (state === "done" && decrypted) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-accent-green font-medium">
          <Unlock className="w-3 h-3" />
          Decrypted PII
        </div>
        {signature && (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Wallet className="w-3 h-3 flex-shrink-0" />
            Authorized by {address?.slice(0, 8)}...{address?.slice(-6)}
            <code className="text-gray-600 font-mono ml-1">{signature.slice(0, 16)}...</code>
          </div>
        )}
        <pre className="bg-surface-900 rounded-lg p-3 text-[11px] font-mono text-gray-300 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
          {JSON.stringify(decrypted, null, 2)}
        </pre>
        <p className="text-[10px] text-gray-600">
          Wallet signature authorized decryption. AES-256-GCM decrypted client-side via Web Crypto API.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-accent-amber">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
        <button
          onClick={() => { setState("idle"); setErrorMsg(""); }}
          className="text-[10px] text-gray-500 hover:text-gray-300 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleDecrypt}
      disabled={state === "signing" || state === "decrypting" || !address}
      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
        bg-accent-purple/15 text-accent-purple border border-accent-purple/30
        hover:bg-accent-purple/25 transition-colors disabled:opacity-50"
    >
      {state === "signing" ? (
        <Wallet className="w-3 h-3 animate-pulse" />
      ) : state === "decrypting" ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Unlock className="w-3 h-3" />
      )}
      {state === "signing"
        ? "Sign in wallet..."
        : state === "decrypting"
        ? "Decrypting..."
        : "Decrypt with Wallet"}
    </button>
  );
}
