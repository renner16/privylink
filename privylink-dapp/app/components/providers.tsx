"use client";

import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren, useEffect } from "react";

import { autoDiscover, createClient } from "@solana/client";

// Get RPC endpoint from environment variable, default to devnet
const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Debug: Log the RPC endpoint being used (only on client)
if (typeof window !== "undefined") {
  console.log("🔗 PrivyLink RPC Endpoint:", RPC_ENDPOINT);
  console.log("🌐 Environment variable:", process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "Not set (using default devnet)");
  console.log("✅ App está configurado para:", RPC_ENDPOINT.includes("devnet") ? "DEVNET ✅" : "MAINNET ⚠️");
}

const client = createClient({
  endpoint: RPC_ENDPOINT,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: PropsWithChildren) {
  useEffect(() => {
    // Verify the client is using the correct endpoint
    console.log("🔍 Client endpoint:", RPC_ENDPOINT);
    console.log("🔍 Is devnet?", RPC_ENDPOINT.includes("devnet"));
  }, []);

  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
