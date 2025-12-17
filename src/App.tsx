import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Header } from "@/components/layout/Header";
import { useWebSocket } from "@/hooks/useWebSocket";
import { HistoryPage } from "@/pages/HistoryPage";
import { HomePage } from "@/pages/HomePage";
import { useJobStore, useHasActiveJobs } from "@/store/jobStore";
import { useUploadStore } from "@/store/uploadStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  // Initialize WebSocket for real-time updates
  useWebSocket();

  // Initialize session once at app level
  const initSessionAsync = useJobStore((state) => state.initSessionAsync);
  useEffect(() => {
    initSessionAsync();
  }, [initSessionAsync]);

  // Warn user when navigating away during active uploads
  const hasActiveJobs = useHasActiveJobs();
  const pendingFiles = useUploadStore((state) => state.files);
  const hasUploadsInProgress = hasActiveJobs || pendingFiles.length > 0;

  useEffect(() => {
    if (!hasUploadsInProgress) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages but still show a generic prompt
      e.returnValue =
        "You have uploads in progress. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUploadsInProgress]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
