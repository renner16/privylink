/**
 * RPC Configuration
 * Supports multiple RPC providers with fallback logic
 *
 * Priority:
 * 1. QuickNode (if configured) - for QuickNode bounty eligibility
 * 2. Helius (default) - recommended for demo
 * 3. Public devnet fallback
 */

export type RpcProvider = 'quicknode' | 'helius' | 'public';

/**
 * Get the RPC endpoint based on environment configuration
 */
export const getRpcEndpoint = (): string => {
  // Priority 1: QuickNode (if configured)
  const quicknodeRpc = process.env.NEXT_PUBLIC_QUICKNODE_RPC;
  if (quicknodeRpc && quicknodeRpc.trim() !== '') {
    return quicknodeRpc;
  }

  // Priority 2: Helius (default)
  const heliusRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (heliusRpc && !heliusRpc.includes('YOUR_')) {
    return heliusRpc;
  }

  // Priority 3: Public devnet fallback
  return 'https://api.devnet.solana.com';
};

/**
 * Get the current RPC provider name
 */
export const getRpcProvider = (): RpcProvider => {
  const quicknodeRpc = process.env.NEXT_PUBLIC_QUICKNODE_RPC;
  if (quicknodeRpc && quicknodeRpc.trim() !== '') {
    return 'quicknode';
  }

  const heliusRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (heliusRpc && !heliusRpc.includes('YOUR_')) {
    return 'helius';
  }

  return 'public';
};

/**
 * Get display name for the current RPC provider
 */
export const getRpcProviderName = (): string => {
  const provider = getRpcProvider();
  switch (provider) {
    case 'quicknode':
      return 'QuickNode';
    case 'helius':
      return 'Helius';
    default:
      return 'Public Devnet';
  }
};
