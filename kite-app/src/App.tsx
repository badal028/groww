import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { BottomNav, Toasts } from "@/components/Shell";
import { AppProvider, useApp } from "@/state/AppContext";
import Bids from "@/pages/Bids";
import Completed from "@/pages/Completed";
import Login from "@/pages/Login";
import OrderScreen from "@/pages/OrderScreen";
import Orders from "@/pages/Orders";
import Portfolio from "@/pages/Portfolio";
import Profile from "@/pages/Profile";
import Search from "@/pages/Search";
import Watchlist from "@/pages/Watchlist";

function Guard({ children }: { children: ReactNode }) {
  const { ready, user } = useApp();
  if (!ready) return <div className="boot"><span className="spinner dark" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function TabsLayout() {
  return (
    <div className="tabs-layout">
      <div className="tabs-main">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

function LoginRoute() {
  const { ready, user } = useApp();
  if (!ready) return <div className="boot"><span className="spinner dark" /></div>;
  if (user) return <Navigate to="/watchlist" replace />;
  return <Login />;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="app">
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              element={
                <Guard>
                  <TabsLayout />
                </Guard>
              }
            >
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/bids" element={<Bids />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
            <Route path="/search" element={<Guard><Search /></Guard>} />
            <Route path="/order/:side" element={<Guard><OrderScreen /></Guard>} />
            <Route path="/completed" element={<Guard><Completed /></Guard>} />
            <Route path="*" element={<Navigate to="/watchlist" replace />} />
          </Routes>
          <Toasts />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
