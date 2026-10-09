"use client";

import { useEffect, useRef } from "react";
import {
  ColorType,
  LineStyle,
  createChart,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

export type ChartStyle = "candle" | "bar" | "line";

export type ChartBar = { t: string; o: string; h: string; l: string; c: string; v?: string };

export function LightweightChart({
  bars,
  bid,
  ask,
  style = "candle",
}: {
  bars: ChartBar[];
  bid?: string;
  ask?: string;
  style?: ChartStyle;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#000000" },
        textColor: "#b0b0b0",
        fontFamily: "Segoe UI, Tahoma, sans-serif",
        fontSize: 11,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: "#1a1a1a" },
        horzLines: { color: "#1a1a1a" },
      },
      rightPriceScale: { borderColor: "#333" },
      timeScale: { borderColor: "#333", timeVisible: true },
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const candleData = bars.map((b) => ({
      time: (Math.floor(Date.parse(b.t) / 1000) || 0) as Time,
      open: Number(b.o),
      high: Number(b.h),
      low: Number(b.l),
      close: Number(b.c),
    }));
    const lineData = candleData.map((b) => ({ time: b.time, value: b.close }));
    const volData = bars.map((b, i) => ({
      time: candleData[i]?.time,
      value: Number(b.v ?? 0),
      color: Number(b.c) >= Number(b.o) ? "rgba(46, 204, 113, 0.4)" : "rgba(231, 76, 60, 0.4)",
    }));

    let series: ISeriesApi<"Candlestick"> | ISeriesApi<"Bar"> | ISeriesApi<"Line">;
    if (style === "line") {
      series = chart.addSeries(LineSeries, { color: "#4fc3f7", lineWidth: 2 });
      series.setData(lineData);
    } else if (style === "bar") {
      series = chart.addSeries(BarSeries, { upColor: "#2ecc71", downColor: "#e74c3c" });
      series.setData(candleData);
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#2ecc71",
        downColor: "#e74c3c",
        borderUpColor: "#2ecc71",
        borderDownColor: "#e74c3c",
        wickUpColor: "#2ecc71",
        wickDownColor: "#e74c3c",
      });
      series.setData(candleData);
    }
    const volume = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" } });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(volData.filter((v) => v.time != null) as Array<{ time: Time; value: number; color: string }>);
    const bidN = Number(bid);
    const askN = Number(ask);
    if (Number.isFinite(bidN) && bidN > 0) {
      series.createPriceLine({ price: bidN, color: "#e74c3c", lineStyle: LineStyle.Dashed, title: "Bid", lineWidth: 1, axisLabelVisible: true });
    }
    if (Number.isFinite(askN) && askN > 0) {
      series.createPriceLine({ price: askN, color: "#2ecc71", lineStyle: LineStyle.Dashed, title: "Ask", lineWidth: 1, axisLabelVisible: true });
    }
    chart.timeScale().fitContent();
    return () => {
      chart.removeSeries(series);
      chart.removeSeries(volume);
    };
  }, [bars, bid, ask, style]);

  if (!bars.length) {
    return <div className="mt5-chart-host" style={{ display: "grid", placeItems: "center", color: "#888" }}>No chart data</div>;
  }
  return <div ref={host} className="mt5-chart-host" role="img" aria-label="Price chart" />;
}
