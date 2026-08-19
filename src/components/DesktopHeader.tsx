import React, { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight, Headphones, Landmark, Receipt, Search, Settings, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StockSearchDialog } from "@/components/StockSearch";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Moon, Sun } from "lucide-react";

function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]!}${parts[parts.length - 1]![0]!}`.toUpperCase();
  if (parts.length === 1 && parts[0]!.length >= 2) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

interface DesktopHeaderProps {
  title: string;
}

const DesktopHeader: React.FC<DesktopHeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [stockSearchOpen, setStockSearchOpen] = useState(false);

  const dropdownItems = useMemo(
    () => [
      {
        icon: Wallet,
        label: user
          ? `₹${user.walletInr.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "—",
        subLabel: "Paper wallet (Stocks, F&O)",
      },
      { icon: Receipt, label: "All Orders" },
      { icon: Landmark, label: "Bank Details" },
      { icon: Headphones, label: "24 x 7 Customer Support" },
      { icon: Receipt, label: "Reports" },
    ],
    [user],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setStockSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    <header className="hidden lg:flex items-center justify-between border-b border-border bg-card px-8 py-4">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStockSearchOpen(true)}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          aria-label="Search stocks"
        >
          <Search className="h-5 w-5" />
        </button>

        <button
          onClick={toggleTheme}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-9 w-9 overflow-hidden rounded-full bg-muted">
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-muted-foreground">
                {user ? avatarInitials(user.name) : "—"}
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-[340px] rounded-xl border border-border bg-card p-0">
            <div className="flex items-start justify-between border-b border-border p-4">
              <div>
                <p className="text-2xl font-semibold leading-none text-foreground">{user?.name ?? "Guest"}</p>
                <p className="mt-2 text-sm text-muted-foreground">{user?.email ?? "Not signed in"}</p>
              </div>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </button>
            </div>

            <div className="py-1">
              {dropdownItems.map((item) => (
                <DropdownMenuItem
                  key={item.label}
                  className="flex items-center justify-between rounded-none px-4 py-3 focus:bg-muted/60"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      {item.subLabel && <p className="text-xs text-muted-foreground">{item.subLabel}</p>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuItem>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <button
                onClick={toggleTheme}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="text-base font-semibold text-foreground underline decoration-dotted underline-offset-4"
              >
                Log out
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <StockSearchDialog open={stockSearchOpen} onOpenChange={setStockSearchOpen} />
    </>
  );
};

export default DesktopHeader;
