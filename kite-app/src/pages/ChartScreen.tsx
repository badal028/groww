import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { InstrumentName } from "@/components/InstrumentName";
import { IconChevronLeft } from "@/components/Icons";
import { api } from "@/lib/api";
import { fmt, fmtSigned, fmtInt } from "@/lib/format";
import { useLiveQuotes } from "@/lib/market";
import type { Instrument, Position } from "@/lib/types";

const IST_OFFSET = 19800;
const UP = "#26a69a";
const DOWN = "#ef5350";

const INTERVALS = [
  { label: "1m", kite: "minute", sec: 60 },
  { label: "3m", kite: "3minute", sec: 180 },
  { label: "5m", kite: "5minute", sec: 300 },
  { label: "15m", kite: "15minute", sec: 900 },
  { label: "30m", kite: "30minute", sec: 1800 },
  { label: "1H", kite: "60minute", sec: 3600 },
  { label: "1D", kite: "day", sec: 86400 },
] as const;

type Bar = { time: UTCTimestamp; open: number; high: number; low: number; close: number; volume: number };
type NavState = { inst: Instrument; position?: Position | null; from?: string };

export default function ChartScreen() {
  const loc = useLocation();
  const st = loc.state as NavState | null;
  if (!st?.inst) return <Navigate to="/watchlist" replace />;
  return <Chart {...st} />;
}

function Chart({ inst, position, from = "/watchlist" }: NavState) {
  const nav = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lastBarRef = useRef<Bar | null>(null);
  const [ivLabel, setIvLabel] = useState<string>(() => localStorage.getItem("pro_chart_iv") || "5m");
  const [legend, setLegend] = useState<Bar | null>(null);
  const [prevClose, setPrevClose] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const iv = INTERVALS.find((i) => i.label === ivLabel) || INTERVALS[2];

  const q = useLiveQuotes([inst.key]);
  const v = q(inst.key);
  const ch = v?.change ?? 0;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#787b86",
        fontFamily: "Open Sans, sans-serif",
        fontSize: 11,
      },
      grid: { vertLines: { color: "#f0f3fa" }, horzLines: { color: "#f0f3fa" } },
      rightPriceScale: { borderColor: "#e0e3eb", scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: "#e0e3eb", timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#9598a1", labelBackgroundColor: "#131722" },
        horzLine: { color: "#9598a1", labelBackgroundColor: "#131722" },
      },
    });
    const candles = chart.addCandlestickSeries({
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceLineVisible: true,
    });
    const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    chart.subscribeCrosshairMove((p) => {
      const d = p.seriesData.get(candles) as Bar | undefined;
      setLegend(d ? { ...d, volume: (p.seriesData.get(vol) as { value?: number } | undefined)?.value ?? 0 } : lastBarRef.current);
    });
    chartRef.current = chart;
    candleRef.current = candles;
    volRef.current = vol;
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pro_chart_iv", iv.label);
    let cancelled = false;
    setLoading(true);
    setNote("");
    lastBarRef.current = null;
    candleRef.current?.setData([]);
    volRef.current?.setData([]);
    api<{ candles: { t: number; o: number; h: number; l: number; c: number; v: number }[] }>(
      `/kite-app/candles?key=${encodeURIComponent(inst.key)}&interval=${iv.kite}`,
    )
      .then((r) => {
        if (cancelled) return;
        const bars: Bar[] = (r.candles || []).map((c) => ({
          time: (c.t + IST_OFFSET) as UTCTimestamp,
          open: c.o,
          high: c.h,
          low: c.l,
          close: c.c,
          volume: c.v,
        }));
        candleRef.current?.setData(bars);
        volRef.current?.setData(
          bars.map((b) => ({ time: b.time, value: b.volume, color: b.close >= b.open ? "rgba(38,166,154,0.35)" : "rgba(239,83,80,0.35)" })),
        );
        lastBarRef.current = bars[bars.length - 1] || null;
        setLegend(lastBarRef.current);
        setPrevClose(bars.length > 1 ? bars[bars.length - 2].close : null);
        chartRef.current?.timeScale().scrollToRealTime();
      })
      .catch((e) => {
        if (!cancelled) setNote(e instanceof Error ? e.message : "Chart data unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inst.key, iv.kite, iv.label]);

  useEffect(() => {
    const ltp = v?.last;
    if (!ltp || !candleRef.current) return;
    const nowIst = Math.floor(Date.now() / 1000) + IST_OFFSET;
    const bucket = (Math.floor(nowIst / iv.sec) * iv.sec) as UTCTimestamp;
    const last = lastBarRef.current;
    let bar: Bar;
    if (!last || bucket > last.time) {
      bar = { time: bucket, open: last?.close ?? ltp, high: Math.max(last?.close ?? ltp, ltp), low: Math.min(last?.close ?? ltp, ltp), close: ltp, volume: 0 };
    } else {
      bar = { ...last, high: Math.max(last.high, ltp), low: Math.min(last.low, ltp), close: ltp };
    }
    lastBarRef.current = bar;
    candleRef.current.update(bar);
    setLegend((cur) => (!cur || cur.time === bar.time ? bar : cur));
  }, [v?.last, iv.sec]);

  const lg = legend;
  const lgUp = lg ? lg.close >= lg.open : true;
  const lgCh = lg && prevClose ? lg.close - prevClose : lg ? lg.close - lg.open : 0;
  const lgBase = lg ? prevClose || lg.open : 0;

  const go = (side: "BUY" | "SELL") => {
    const qty = side === "SELL" && position && !position.exited ? position.quantity : undefined;
    nav(`/order/${side.toLowerCase()}`, {
      state: { inst, qty, from, exitMax: qty, position: position && !position.exited ? position : null },
    });
  };

  return (
    <div className="screen chart-screen">
      <div className="ch-head">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label="Back">
          <IconChevronLeft size={22} strokeWidth={2} />
        </button>
        <div className="ch-title">
          <div className="ch-name">
            <InstrumentName inst={inst} />
          </div>
          <div className="ch-sub">
            <span>{inst.tag}</span>
            <span className={ch < 0 ? "c-loss" : "c-green"}>{fmt(v?.last)}</span>
            <span>
              {fmtSigned(ch)} ({fmtSigned(v?.changePct)}%)
            </span>
          </div>
        </div>
      </div>

      <div className="ch-intervals">
        {INTERVALS.map((i) => (
          <button key={i.label} type="button" className={`ch-iv${i.label === iv.label ? " active" : ""}`} onClick={() => setIvLabel(i.label)}>
            {i.label}
          </button>
        ))}
      </div>

      <div className="ch-body">
        {lg && (
          <div className="ch-legend">
            <span className="ch-lg-sym">
              {inst.tradingsymbol} · {iv.label}
            </span>
            <span>
              O <b className={lgUp ? "up" : "down"}>{fmt(lg.open)}</b>
            </span>
            <span>
              H <b className={lgUp ? "up" : "down"}>{fmt(lg.high)}</b>
            </span>
            <span>
              L <b className={lgUp ? "up" : "down"}>{fmt(lg.low)}</b>
            </span>
            <span>
              C <b className={lgUp ? "up" : "down"}>{fmt(lg.close)}</b>
            </span>
            <b className={lgCh >= 0 ? "up" : "down"}>
              {fmtSigned(lgCh)} ({fmtSigned(lgBase ? (lgCh / lgBase) * 100 : 0)}%)
            </b>
            {lg.volume > 0 && (
              <span>
                Vol <b className={lgUp ? "up" : "down"}>{fmtInt(lg.volume)}</b>
              </span>
            )}
          </div>
        )}
        <div ref={boxRef} className="ch-canvas" />
        {loading && (
          <div className="ch-overlay">
            <span className="spinner dark" />
          </div>
        )}
        {!loading && note && <div className="ch-note">{note}</div>}
      </div>

      <div className="ch-actions">
        <button type="button" className="btn btn-blue" onClick={() => go("BUY")}>
          BUY
        </button>
        <button type="button" className="btn btn-red" onClick={() => go("SELL")}>
          SELL
        </button>
      </div>
    </div>
  );
}
