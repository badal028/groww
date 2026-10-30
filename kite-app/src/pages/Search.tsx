import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InstrumentName } from "@/components/InstrumentName";
import { IconBack, IconCheck, IconPlus } from "@/components/Icons";
import { Fab } from "@/components/Shell";
import { api } from "@/lib/api";
import type { Instrument } from "@/lib/types";
import { useApp } from "@/state/AppContext";

const TABS = ["#", "MF", "IPO", "Events", "Brands", "ETF"];

export default function Search() {
  const nav = useNavigate();
  const { groups, activeGroup, addToWatchlist, removeFromWatchlist, toast } = useApp();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("#");
  const [results, setResults] = useState<Instrument[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);
  const added = new Set((groups[activeGroup] || []).map((i) => i.key));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const id = ++reqId.current;
    const t = setTimeout(() => {
      api<{ results: Instrument[] }>(`/kite-app/search?q=${encodeURIComponent(term)}&limit=60`)
        .then((r) => {
          if (id === reqId.current) setResults(r.results || []);
        })
        .catch(() => undefined);
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (inst: Instrument) => {
    if (added.has(inst.key)) {
      removeFromWatchlist(inst.key);
      return;
    }
    if (added.size >= 250) {
      toast("Watchlist is full", "error");
      return;
    }
    addToWatchlist(inst);
    inputRef.current?.blur();
    toast("Added to watchlist");
  };

  const shown =
    tab === "#" ? results : tab === "ETF" ? results.filter((r) => /ETF|BEES/i.test(`${r.tradingsymbol} ${r.name}`)) : [];

  return (
    <div className="screen search-screen">
      <div className="srch-head">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconBack size={20} />
        </button>
        <input
          ref={inputRef}
          className="srch-input"
          placeholder="Search eg: infy bse, nifty fut"
          value={q}
          onChange={(e) => setQ(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          onKeyDown={(e) => {
            if (e.key === "Enter") inputRef.current?.blur();
          }}
        />
        {q && (
          <button
            type="button"
            className="srch-clear"
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="srch-group">
        Adding to group <b>Default</b>
      </div>
      <div className="srch-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={`srch-tab${t === tab ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="screen-body">
        {shown.map((inst) => {
          const isAdded = added.has(inst.key);
          return (
            <div key={inst.key} className="srch-row" onClick={() => toggle(inst)}>
              <span className={`ex-chip ex-${inst.tag.toLowerCase()}`}>{inst.tag}</span>
              <div className="srch-mid">
                <div className="srch-name">
                  <InstrumentName inst={inst} />
                </div>
                {inst.subtitle && <div className="srch-sub">{inst.subtitle}</div>}
              </div>
              <button
                type="button"
                className={`add-btn${isAdded ? " added" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(inst);
                }}
                aria-label={isAdded ? "Remove" : "Add"}
              >
                {isAdded ? <IconCheck size={14} strokeWidth={2.4} /> : <IconPlus size={14} strokeWidth={2} />}
              </button>
            </div>
          );
        })}
      </div>
      <Fab />
    </div>
  );
}
