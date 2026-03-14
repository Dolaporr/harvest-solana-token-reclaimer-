// ─────────────────────────────────────────────────────────────────────────────
// src/App.tsx
//
// Root app component. Wraps the entire tree with:
//   • WalletProvider  — Solana connection + wallet adapter context
//   • QueryClientProvider — TanStack Query for any async data fetching
//   • TooltipProvider, Toaster, Sonner — UI providers
//   • BrowserRouter — client-side routing
// ─────────────────────────────────────────────────────────────────────────────

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/providers/WalletProvider";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // Cache RPC results for 30s
      retry: 2,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WalletProvider>
      <TooltipProvider>
        <Toaster />
        {/* Sonner is used for toast notifications from useReclaimAccounts */}
        <Sonner position="bottom-right" richColors closeButton />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WalletProvider>
  </QueryClientProvider>
);

export default App;
