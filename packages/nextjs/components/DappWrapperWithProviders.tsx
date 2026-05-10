"use client";

import { useEffect, useMemo, useState } from "react";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { IndexedDBStorage, RelayerWeb, SepoliaConfig, type ZamaSDKEvent } from "@zama-fhe/sdk";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { Header } from "~~/components/Header";
import { BlockieAvatar } from "~~/components/helper";
import { wagmiConfig } from "~~/services/web3/wagmiConfig";
import { WagmiSigner } from "~~/services/web3/wagmiSigner";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const ZamaRuntimeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const runtime = useMemo(() => {
    if (!mounted || typeof window === "undefined") return undefined;

    const signer = new WagmiSigner({ config: wagmiConfig });
    const storage = new IndexedDBStorage("KeypairStore", 1);
    const sessionStorage = new IndexedDBStorage("SignatureStore", 1);

    return {
      signer,
      storage,
      sessionStorage,
      relayer: new RelayerWeb({
        getChainId: () => signer.getChainId(),
        transports: {
          [SepoliaConfig.chainId]: SepoliaConfig,
        },
      }),
    };
  }, [mounted]);

  useEffect(() => {
    return () => {
      runtime?.relayer.terminate();
    };
  }, [runtime]);

  if (!runtime) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07110f] text-slate-100">
        <div className="rounded-lg border border-white/10 bg-white/[0.055] px-5 py-4 text-sm font-semibold">
          Starting encrypted runtime...
        </div>
      </main>
    );
  }

  function dispatchEvent(event: ZamaSDKEvent) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(event.type, { detail: event }));
    }
  }

  return (
    <ZamaProvider
      relayer={runtime.relayer}
      signer={runtime.signer}
      storage={runtime.storage}
      sessionStorage={runtime.sessionStorage}
      onEvent={dispatchEvent}
    >
      {children}
    </ZamaProvider>
  );
};

export const DappWrapperWithProviders = ({ children }: { children: React.ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          avatar={BlockieAvatar}
          theme={mounted ? (isDarkMode ? darkTheme() : lightTheme()) : lightTheme()}
        >
          <ZamaRuntimeProvider>
            <ProgressBar height="3px" color="#6ee7b7" />
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="relative flex flex-1 flex-col">{children}</main>
            </div>
            <Toaster />
          </ZamaRuntimeProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
