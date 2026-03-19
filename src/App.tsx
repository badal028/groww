import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import SplashScreen from "./pages/SplashScreen";
import LoginPage from "./pages/LoginPage";
import StocksPage from "./pages/StocksPage";
import StockDetailPage from "./pages/StockDetailPage";
import MutualFundsPage from "./pages/MutualFundsPage";
import ProfilePage from "./pages/ProfilePage";
import BottomNav from "./components/BottomNav";
import DesktopSidebar from "./components/DesktopSidebar";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const AppLayout = () => {
  const location = useLocation();
  const isFullScreenPage = location.pathname === '/' || location.pathname === '/login';

  if (isFullScreenPage) {
    return (
      <div className="mx-auto max-w-lg">
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <DesktopSidebar />
      <main className="flex-1 min-w-0">
        <Routes>
          <Route path="/stocks" element={<StocksPage />} />
          <Route path="/stock/:id" element={<StockDetailPage />} />
          <Route path="/mutual-funds" element={<MutualFundsPage />} />
          <Route path="/pay" element={<StocksPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
