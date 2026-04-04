/**
 * Sumsub WebSDK iframe wrapper.
 * Pattern from TetraFi's implementation, adapted for our dark theme.
 *
 * In production: CRE Workflow A generates the access token inside TEE.
 * In demo: a tiny local proxy generates it (sumsub-proxy.ts).
 */
import SumsubWebSdk from "@sumsub/websdk-react";

interface SumsubVerificationProps {
  accessToken: string;
  onComplete: () => void;
  onError?: (error: unknown) => void;
  onTokenExpired?: () => Promise<string>;
}

export default function SumsubVerification({
  accessToken,
  onComplete,
  onError,
  onTokenExpired,
}: SumsubVerificationProps) {
  const handleMessage = (type: string, _payload: unknown) => {
    // Sumsub SDK events that indicate completion
    if (
      type === "idCheck.onApplicantSubmitted" ||
      type === "idCheck.onApplicantReviewComplete" ||
      type === "idCheck.onApplicantStatusChanged"
    ) {
      onComplete();
    }
  };

  const handleError = (error: unknown) => {
    console.error("Sumsub SDK error:", error);
    onError?.(error);
  };

  const expirationHandler = async () => {
    if (onTokenExpired) {
      return await onTokenExpired();
    }
    // Default: return empty string (SDK will show error)
    return "";
  };

  return (
    <div className="rounded-xl overflow-hidden border border-surface-600">
      <SumsubWebSdk
        accessToken={accessToken}
        expirationHandler={expirationHandler}
        onMessage={handleMessage}
        onError={handleError}
        config={{
          lang: "en",
          theme: "dark",
        }}
        options={{
          adaptIframeHeight: true,
        }}
      />
    </div>
  );
}
