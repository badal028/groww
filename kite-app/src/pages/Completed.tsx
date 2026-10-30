import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { IconCheck } from "@/components/Icons";
import { Fab } from "@/components/Shell";

const AUTO_CLOSE_MS = 3000;

export default function Completed() {
  const loc = useLocation();
  const nav = useNavigate();
  const st = loc.state as { text?: string; from?: string } | null;
  const dest = st?.from || "/watchlist";

  useEffect(() => {
    if (!st) return;
    const t = setTimeout(() => nav(dest, { replace: true, state: { tab: "positions" } }), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [dest, nav, st]);

  if (!st) return <Navigate to="/watchlist" replace />;

  return (
    <div className="screen completed">
      <div className="cp-center">
        <div className="cp-circle">
          <IconCheck size={34} strokeWidth={2.2} />
        </div>
        <div className="cp-title">Completed</div>
        <div className="cp-sub">{st.text}</div>
      </div>
      <Fab style={{ right: 12, bottom: 86 }} />
      <div className="cp-foot">
        <button type="button" className="cp-close" onClick={() => nav(dest, { replace: true, state: { tab: "positions" } })}>
          <span className="cp-progress" style={{ animationDuration: `${AUTO_CLOSE_MS}ms` }} />
          <span className="cp-close-label">Close</span>
        </button>
      </div>
    </div>
  );
}
