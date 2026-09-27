import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AiSettingsProvider } from "@/contexts/AiSettingsContext";
import { AiOnboardingDialog } from "@/components/ai/AiOnboardingDialog";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AiSettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AiOnboardingDialog />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* Evaluation runs dev-side only — `npm run eval`. There is no in-app
                  harness, so testing cannot spend the product's Lovable rate limit. */}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AiSettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
