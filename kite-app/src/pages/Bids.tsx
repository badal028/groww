import { useState } from "react";
import { EmptyState, Fab, IndexStrip } from "@/components/Shell";

const TABS = ["IPO", "Govt. securities", "Auctions", "Corporate actions"] as const;

export default function Bids() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("IPO");
  return (
    <div className="screen">
      <IndexStrip />
      <div className="top-tabs scroll">
        {TABS.map((t) => (
          <button key={t} type="button" className={`top-tab${t === tab ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="screen-body">
        <EmptyState
          title={tab === "IPO" ? "No IPOs" : tab === "Govt. securities" ? "No G-Secs" : tab === "Auctions" ? "No auctions" : "No corporate actions"}
          sub="Nothing to show right now"
        />
      </div>
      <Fab />
    </div>
  );
}
