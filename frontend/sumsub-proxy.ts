/**
 * Tiny local proxy for Sumsub token generation (hackathon demo only).
 *
 * In production: CRE Workflow A generates the token inside TEE.
 * In demo: this 30-line Bun server generates it locally.
 *
 * Run: bun sumsub-proxy.ts
 * Then frontend calls: http://localhost:3001/token?userId=0xWallet
 */
import { createHmac } from "crypto";

const APP_TOKEN = "sbx:hbGNWhIC7lz2DbKorGEtjdGI.oKkt6JKtbmRkdsbAEyrdSPbzlYO2tb4m";
const SECRET_KEY = "00E19drncuW96bGjVx2g5OBgfVKOHDfs";
const LEVEL = "id-and-liveness";

Bun.serve({
  port: 3001,
  async fetch(req) {
    // CORS
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
    }

    const url = new URL(req.url);
    if (url.pathname !== "/token") {
      return new Response("Not found", { status: 404 });
    }

    const userId = url.searchParams.get("userId") || `demo-${Date.now()}`;
    const ts = Math.floor(Date.now() / 1000).toString();
    const path = `/resources/accessTokens?userId=${userId}&levelName=${LEVEL}&ttlInSecs=3600`;
    const sig = createHmac("sha256", SECRET_KEY).update(ts + "POST" + path).digest("hex");

    const resp = await fetch(`https://api.sumsub.com${path}`, {
      method: "POST",
      headers: {
        "X-App-Token": APP_TOKEN,
        "X-App-Access-Sig": sig,
        "X-App-Access-Ts": ts,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    const data = await resp.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  },
});

console.log("Sumsub token proxy running on http://localhost:3001/token");
console.log("In production, CRE Workflow A generates tokens inside the TEE.");
