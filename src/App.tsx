import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import SplashScreen from "./pages/SplashScreen";
import LoginPage from "./pages/LoginPage";
import StocksPage from "./pages/StocksPage";
import StockDetailPage from "./pages/StockDetailPage";
import MutualFundsPage from "./pages/MutualFundsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import ContactUsPage from "./pages/ContactUsPage";
import TermsConditionsPage from "./pages/TermsConditionsPage";
import RefundsCancellationsPage from "./pages/RefundsCancellationsPage";
import OtherDetailsPage from "./pages/OtherDetailsPage";
import DesktopSidebar from "./components/DesktopSidebar";
import NotFound from "./pages/NotFound.tsx";
import PaperTradingLeaguePage from "./pages/seo/PaperTradingLeaguePage";
import StockTradingContestPage from "./pages/seo/StockTradingContestPage";
import FantasyStyleStockLeaguePage from "./pages/seo/FantasyStyleStockLeaguePage";
import AboutGrowwTraderPage from "./pages/seo/AboutGrowwTraderPage";

const queryClient = new QueryClient();


const AppLayout = () => {
  const location = useLocation();
  const { token, loading } = useAuth();
  const isFullScreenPage = location.pathname === '/' || location.pathname === '/login';
  const hideDesktopSidebar = location.pathname === '/stocks';

  if (!isFullScreenPage && !loading && !token) {
    return <LoginPage />;
  }

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
    <div className="flex min-h-screen w-full lg:h-screen lg:overflow-hidden">
      {!hideDesktopSidebar && <DesktopSidebar />}
      <main className={`flex-1 min-w-0 lg:h-screen lg:overflow-y-auto ${hideDesktopSidebar ? '' : 'lg:ml-60'}`}>
        <Routes>
          <Route path="/stocks" element={<StocksPage />} />
          <Route path="/stock/:id" element={<StockDetailPage />} />
          <Route path="/mutual-funds" element={<MutualFundsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/contact-us" element={<ContactUsPage />} />
          <Route path="/terms-and-conditions" element={<TermsConditionsPage />} />
          <Route path="/refunds-cancellations" element={<RefundsCancellationsPage />} />
          <Route path="/other-details" element={<OtherDetailsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/learn/paper-trading-league" element={<PaperTradingLeaguePage />} />
              <Route path="/learn/stock-trading-contest-india" element={<StockTradingContestPage />} />
              <Route path="/learn/fantasy-style-stock-league" element={<FantasyStyleStockLeaguePage />} />
              <Route path="/about/growwtrader" element={<AboutGrowwTraderPage />} />
              <Route path="/*" element={<AppLayout />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
