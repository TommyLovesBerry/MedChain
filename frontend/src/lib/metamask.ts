import { BrowserProvider, JsonRpcSigner } from "ethers";

const LOCALHOST_CHAIN_ID_HEX = "0x7a69"; // 31337

declare global {
  interface Window { ethereum?: any }
}

export function hasMetaMask() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectMetaMask(): Promise<JsonRpcSigner> {
  if (!hasMetaMask()) throw new Error("MetaMask not installed. Install the extension and reload.");

  // Make sure we're on the local Hardhat network (chainId 31337). If not, add/switch.
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: LOCALHOST_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    // 4902 = chain not added yet
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: LOCALHOST_CHAIN_ID_HEX,
          chainName: "Hardhat Localhost",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["http://127.0.0.1:8545"],
        }],
      });
    } else {
      throw err;
    }
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

export function onAccountsChanged(cb: (addr: string | null) => void) {
  if (!hasMetaMask()) return () => {};
  const handler = (accs: string[]) => cb(accs[0] ?? null);
  window.ethereum.on("accountsChanged", handler);
  return () => window.ethereum.removeListener?.("accountsChanged", handler);
}

export function onChainChanged(cb: () => void) {
  if (!hasMetaMask()) return () => {};
  window.ethereum.on("chainChanged", cb);
  return () => window.ethereum.removeListener?.("chainChanged", cb);
}
