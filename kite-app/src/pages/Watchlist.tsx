import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InstrumentName } from "@/components/InstrumentName";
import { InstrumentSheet } from "@/components/InstrumentSheet";
import { IconChevronDown, IconGroupSettings, IconPlus, IconSearch, IconSliders } from "@/components/Icons";
import { Fab, IndexStrip } from "@/components/Shell";
import { useLiveQuotes } from "@/lib/market";
import { fmt, fmtSigned } from "@/lib/format";
import type { Instrument } from "@/lib/types";
import { useApp } from "@/state/AppContext";

export default function Watchlist() {
  const { groups, activeGroup, setActiveGroup } = useApp();
  const nav = useNavigate();
  const list = groups[activeGroup] || [];
  const keys = useMemo(() => list.map((i) => i.key), [list]);
  const q = useLiveQuotes(keys);
  const [sel, setSel] = useState<Instrument | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="screen">
      <IndexStrip />
      <div className="wl-groups">
        {[1, 2, 3, 4, 5, 6, 7].map((g) => (
          <button
            key={g}
            type="button"
            className={`wl-g${g === activeGroup ? " active" : ""}`}
            onClick={() => setActiveGroup(g)}
          >
            {g}
          </button>
        ))}
        <button type="button" className="wl-gear" aria-label="Group settings">
          <IconGroupSettings size={15} />
          <IconChevronDown size={10} />
        </button>
      </div>

      <div className="screen-body">
        <div className="wl-search" onClick={() => nav("/search")} role="button" tabIndex={0}>
          <IconSearch size={17} className="c-light" />
          <span className="wl-search-ph">Search &amp; add</span>
          <span className="wl-count">{list.length}/250</span>
          <span className="wl-filter">
            <IconSliders size={17} />
          </span>
        </div>
        <div className="wl-newgroup">
          <button type="button" className="lnk">
            <IconPlus size={14} /> New group
          </button>
        </div>

        {list.map((inst) => {
          const v = q(inst.key);
          const ch = v?.change ?? 0;
          return (
            <div
              key={inst.key}
              className="wl-row"
              onClick={() => {
                setSel(inst);
                setOpen(true);
              }}
            >
              <div className="wl-l">
                <div className="wl-sym">
                  <InstrumentName inst={inst} />
                </div>
                <div className="wl-ex">{inst.tag}</div>
              </div>
              <div className="wl-r">
                <div className={`wl-px ${ch < 0 ? "c-loss" : "c-green"}`}>{fmt(v?.last)}</div>
                <div className="wl-ch">
                  {fmtSigned(ch)} ({fmtSigned(v?.changePct)}%)
                </div>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="wl-empty">
            <div>Nothing here</div>
            <div className="c-light">Use the search bar to add instruments.</div>
          </div>
        )}
      </div>
      <Fab />
      <InstrumentSheet inst={sel} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
