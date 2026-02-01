"use client";

import { SolanaProvider } from "@solana/react-hooks";
import { PropsWithChildren } from "react";

import { autoDiscover, createClient } from "@solana/client";
import { getRpcEndpoint } from "../lib/rpc-config";

const client = createClient({
  endpoint: getRpcEndpoint(),
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: PropsWithChildren) {
  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
