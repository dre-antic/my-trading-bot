"use client";

export function CandleChart({
  bars,
  height = 320,
}: {
  bars: Array<{ t: string; o: string; h: string; l: string; c: string }>;
  height?: number;
}) {
  if (!bars.length) {
    return <div className="muted">No chart data. Refresh market data in Settings if you are in paper/live.</div>;
  }
  const width = Math.max(640, bars.length * 6);
  const highs = bars.map((b) => Number(b.h));
  const lows = bars.map((b) => Number(b.l));
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const pad = (max - min) * 0.06 || 1;
  const top = max + pad;
  const bot = min - pad;
  const span = top - bot || 1;
  const y = (px: number) => ((top - px) / span) * (height - 16) + 8;
  const candleW = Math.max(2, Math.min(8, (width - 24) / bars.length - 2));

  return (
    <div className="chart-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Price chart">
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const py = 8 + p * (height - 16);
          const price = top - p * span;
          return (
            <g key={p}>
              <line x1={0} y1={py} x2={width} y2={py} stroke="#2a3644" strokeWidth="1" />
              <text x={8} y={py - 4} fill="#9a9284" fontSize="10">
                {price.toFixed(span < 0.05 ? 5 : 2)}
              </text>
            </g>
          );
        })}
        {bars.map((b, i) => {
          const x = 28 + i * ((width - 40) / bars.length);
          const o = Number(b.o);
          const c = Number(b.c);
          const up = c >= o;
          const color = up ? "#3fbf8f" : "#e06c75";
          const bodyTop = y(Math.max(o, c));
          const bodyBot = y(Math.min(o, c));
          const bodyH = Math.max(1, bodyBot - bodyTop);
          return (
            <g key={b.t + i}>
              <line x1={x} y1={y(Number(b.h))} x2={x} y2={y(Number(b.l))} stroke={color} strokeWidth="1" />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
