import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSearchUniverse } from "@/data/searchUniverse";
import type { Stock } from "@/data/mockData";
import StockLogo from "@/components/StockLogo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_RESULTS = 12;

function filterStocks(query: string, universe: Stock[]): Stock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return universe
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.symbol.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q),
    )
    .slice(0, MAX_RESULTS);
}

type StockSearchProps = {
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  /** Show Ctrl+K hint (desktop) */
  showShortcutHint?: boolean;
  /** Register global Ctrl/Cmd+K to focus this input */
  enableGlobalShortcut?: boolean;
  /** Called after navigating to a stock (e.g. close dialog) */
  onAfterNavigate?: () => void;
  /** When used inside a dialog: parent `open` — clears query when dialog closes */
  dialogOpen?: boolean;
  /** Focus input on mount (e.g. when dialog opens) */
  autoFocus?: boolean;
  /** Taller results list for use inside `StockSearchDialog` */
  embedInModal?: boolean;
  /** When true (dialog expanded with matches), list fills modal height instead of a floating dropdown */
  fillModalHeight?: boolean;
  /** Notifies dialog: user has typed and there is at least one match — dialog grows to full height */
  onResultValuesChange?: (hasValues: boolean) => void;
};

const StockSearch: React.FC<StockSearchProps> = ({
  className,
  inputClassName,
  placeholder = "Search stocks & indices…",
  showShortcutHint = true,
  enableGlobalShortcut = true,
  onAfterNavigate,
  dialogOpen,
  autoFocus,
  embedInModal,
  fillModalHeight,
  onResultValuesChange,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [shortcutOk, setShortcutOk] = useState(false);

  const universe = useMemo(() => getSearchUniverse(), []);
  const results = useMemo(() => filterStocks(query, universe), [query, universe]);

  const goToStock = useCallback(
    (stock: Stock) => {
      navigate(`/stock/${encodeURIComponent(stock.id)}`);
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
      onAfterNavigate?.();
    },
    [navigate, onAfterNavigate],
  );

  // Avoid focusing a hidden desktop search on mobile (desktop block stays in DOM with `hidden lg:block`).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setShortcutOk(!!e?.isIntersecting && e.intersectionRatio > 0),
      { threshold: [0, 0.01] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!enableGlobalShortcut || !shortcutOk) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableGlobalShortcut, shortcutOk]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (dialogOpen === false) {
      setQuery("");
      setOpen(false);
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (!autoFocus) return;
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [autoFocus]);

  const hasTyped = query.trim().length > 0;
  const hasMatches = results.length > 0;

  useEffect(() => {
    if (!embedInModal || !onResultValuesChange) return;
    onResultValuesChange(hasTyped && hasMatches);
  }, [embedInModal, onResultValuesChange, hasTyped, hasMatches]);

  const useFullHeightList = Boolean(embedInModal && fillModalHeight && hasTyped && hasMatches);

  return (
    <div
      ref={rootRef}
      className={cn(useFullHeightList ? "flex min-h-0 flex-1 flex-col" : "relative", className)}
    >
      <div className={cn("relative", useFullHeightList && "shrink-0")}>
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={cn(
            "h-9 rounded-md pl-9 text-sm",
            showShortcutHint ? "pr-14" : "pr-3",
            inputClassName,
          )}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
        />
        {showShortcutHint && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            Ctrl+K
          </span>
        )}
      </div>

      {open && hasTyped && (
        <ul
          className={cn(
            "overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg",
            useFullHeightList
              ? "mt-3 min-h-0 flex-1"
              : cn(
                  "absolute left-0 right-0 top-full z-50 mt-1",
                  embedInModal
                    ? "max-h-[min(280px,45vh)]"
                    : "max-h-[min(320px,50vh)]",
                ),
          )}
          role="listbox"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
          ) : (
            results.map((stock) => (
              <li key={stock.id} role="option">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/80"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goToStock(stock)}
                >
                  <StockLogo stock={stock} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{stock.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {stock.symbol}
                      {stock.sector === "Index" ? " · Index" : ` · ${stock.exchange}`}
                    </p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default StockSearch;

type StockSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Modal search — use header search icon + this dialog (no always-visible search bar). */
export function StockSearchDialog({ open, onOpenChange }: StockSearchDialogProps) {
  const [expandForResults, setExpandForResults] = useState(false);

  useEffect(() => {
    if (!open) setExpandForResults(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-4 border-border bg-card p-5 sm:p-6",
          "translate-y-0",
          /* Mobile: side gutter */
          "left-5 right-5 w-auto max-w-lg translate-x-0",
          "sm:left-1/2 sm:right-auto sm:w-full sm:max-w-md sm:-translate-x-1/2",
          expandForResults
            ? [
                "top-[2%] flex max-h-[min(96vh,calc(100dvh-1rem))] min-h-0 flex-col overflow-hidden",
                "h-[min(96vh,calc(100dvh-1rem))]",
              ]
            : [
                "top-[14%] grid max-h-[90vh] w-auto overflow-y-auto",
                "h-auto max-w-lg",
              ],
        )}
      >
        <DialogHeader className={cn(expandForResults && "shrink-0")}>
          <DialogTitle>Search stocks & indices</DialogTitle>
          <DialogDescription>Type a company name or symbol</DialogDescription>
        </DialogHeader>
        <StockSearch
          dialogOpen={open}
          autoFocus={open}
          embedInModal
          fillModalHeight={expandForResults}
          onResultValuesChange={setExpandForResults}
          showShortcutHint={false}
          enableGlobalShortcut={false}
          className={cn("w-full", expandForResults && "flex min-h-0 flex-1 flex-col")}
          placeholder="Search stocks…"
          onAfterNavigate={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
