import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  CheckCircle2,
  Database,
  HardDrive,
  Minimize2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

interface SqliteDbStatEntry {
  name: string;
  kind: 'table' | 'index';
  pages: number;
  totalBytes: number;
  usedBytes: number;
  unusedBytes: number;
  fillFactorPct: number;
  cells: number;
  healthScore: number;
  status: 'Optimal' | 'Fair' | 'Fragmented';
}

interface SqliteHealthSnapshot {
  timestamp: string;
  timestampMs: number;
  freelistFragPct: number;
  btreeUnusedPct: number;
  cacheHitRatio: number;
  workingSetFitPct: number;
  indexHealthScore: number;
  pageCount: number;
  freelistCount: number;
  sizeBytes: number;
  cacheHits: number;
  cacheMisses: number;
  eventLabel?: string;
}

interface SqliteHealthReport {
  current: SqliteHealthSnapshot;
  history: SqliteHealthSnapshot[];
  tablesAndIndexes: SqliteDbStatEntry[];
  integrity: {
    quickCheck: string;
    journalMode: string;
    autoVacuumMode: string;
    cacheSizeKiB: number;
    pageSize: number;
    totalCacheHits: number;
    totalCacheMisses: number;
  };
}

interface SqliteDatabaseHealthProps {
  theme: 'light' | 'dark';
  refreshTrigger?: number;
  onAfterCompact?: () => Promise<void> | void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>, fallback = 520): number {
  const [width, setWidth] = useState<number>(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 120) setWidth(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

// ==========================================
// D3 CHART 1: PAGE FRAGMENTATION OVER TIME
// ==========================================
function FragmentationD3Chart({
  data,
  theme,
}: {
  data: SqliteHealthSnapshot[];
  theme: 'light' | 'dark';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = useContainerWidth(containerRef, 480);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    point: SqliteHealthSnapshot;
  } | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || data.length === 0) return;

    const height = 210;
    const margin = { top: 14, right: 16, bottom: 28, left: 42 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const extent = d3.extent(data, (d) => d.timestampMs) as [number, number];
    const minT = extent[0] === extent[1] ? extent[0] - 10000 : extent[0];
    const maxT = extent[0] === extent[1] ? extent[1] + 10000 : extent[1];

    const x = d3.scaleTime().domain([new Date(minT), new Date(maxT)]).range([0, innerW]);

    const maxVal = Math.max(
      15,
      d3.max(data, (d) => Math.max(d.freelistFragPct, d.btreeUnusedPct)) || 15
    );
    const y = d3.scaleLinear().domain([0, Math.min(100, Math.ceil(maxVal * 1.15))]).nice().range([innerH, 0]);

    const gridColor = theme === 'light' ? '#e4e4e7' : '#1e293b';
    const textColor = theme === 'light' ? '#52525b' : '#94a3b8';

    // Horizontal gridlines
    g.append('g')
      .selectAll('line')
      .data(y.ticks(4))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3 3');

    // Gradient definitions
    const defs = svg.append('defs');
    const btreeGrad = defs
      .append('linearGradient')
      .attr('id', 'btree-slack-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    btreeGrad.append('stop').attr('offset', '0%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.28);
    btreeGrad.append('stop').attr('offset', '100%').attr('stop-color', '#6366f1').attr('stop-opacity', 0.02);

    const freelistGrad = defs
      .append('linearGradient')
      .attr('id', 'freelist-frag-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    freelistGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.35);
    freelistGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.02);

    // B-tree slack area & line
    const btreeArea = d3
      .area<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y0(innerH)
      .y1((d) => y(d.btreeUnusedPct))
      .curve(d3.curveMonotoneX);

    const btreeLine = d3
      .line<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y((d) => y(d.btreeUnusedPct))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(data).attr('fill', 'url(#btree-slack-grad)').attr('d', btreeArea);
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 2)
      .attr('d', btreeLine);

    // Freelist fragmentation area & line
    const freelistArea = d3
      .area<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y0(innerH)
      .y1((d) => y(d.freelistFragPct))
      .curve(d3.curveMonotoneX);

    const freelistLine = d3
      .line<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y((d) => y(d.freelistFragPct))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(data).attr('fill', 'url(#freelist-frag-grad)').attr('d', freelistArea);
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.2)
      .attr('d', freelistLine);

    // Points
    g.selectAll('.dot-btree')
      .data(data)
      .join('circle')
      .attr('cx', (d) => x(new Date(d.timestampMs)))
      .attr('cy', (d) => y(d.btreeUnusedPct))
      .attr('r', 2.5)
      .attr('fill', '#6366f1');

    g.selectAll('.dot-freelist')
      .data(data)
      .join('circle')
      .attr('cx', (d) => x(new Date(d.timestampMs)))
      .attr('cy', (d) => y(d.freelistFragPct))
      .attr('r', 2.5)
      .attr('fill', '#f59e0b');

    // Axes
    const xAxis = d3
      .axisBottom(x)
      .ticks(Math.min(5, data.length))
      .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date));
    const yAxis = d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}%`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').attr('stroke', gridColor))
      .call((sel) => sel.selectAll('text').attr('fill', textColor).style('font-size', '10px').style('font-family', 'monospace'));

    g.append('g')
      .call(yAxis)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('line').remove())
      .call((sel) => sel.selectAll('text').attr('fill', textColor).style('font-size', '10px').style('font-family', 'monospace'));

    // Interactive hover overlay
    const bisect = d3.bisector<SqliteHealthSnapshot, Date>((d) => new Date(d.timestampMs)).left;
    const crosshair = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', theme === 'light' ? '#71717a' : '#94a3b8')
      .attr('stroke-dasharray', '3 3')
      .style('opacity', 0);

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const hoveredDate = x.invert(mx);
        const idx = Math.min(data.length - 1, Math.max(0, bisect(data, hoveredDate, 0)));
        const d0 = data[Math.max(0, idx - 1)];
        const d1 = data[idx];
        const chosen =
          d0 && hoveredDate.getTime() - d0.timestampMs < d1.timestampMs - hoveredDate.getTime()
            ? d0
            : d1;
        const cx = x(new Date(chosen.timestampMs));
        crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 0.8);
        setHoverInfo({ x: margin.left + cx, point: chosen });
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        setHoverInfo(null);
      });
  }, [data, width, theme]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} className="w-full h-[210px] overflow-visible" />
      {hoverInfo && (
        <div
          className={`pointer-events-none absolute top-2 z-20 px-2.5 py-1.5 rounded-lg border font-mono text-[10px] shadow-md ${
            theme === 'light'
              ? 'bg-white/95 border-zinc-300 text-zinc-900'
              : 'bg-slate-950/95 border-slate-700 text-slate-100'
          }`}
          style={{
            left: hoverInfo.x > width * 0.6 ? Math.max(8, hoverInfo.x - 168) : hoverInfo.x + 12,
          }}
        >
          <p className="font-bold text-orange-500 mb-0.5">{hoverInfo.point.timestamp}</p>
          <p>Freelist Frag: {hoverInfo.point.freelistFragPct}% ({hoverInfo.point.freelistCount}/{hoverInfo.point.pageCount} pgs)</p>
          <p>B-Tree Slack: {hoverInfo.point.btreeUnusedPct}%</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// D3 CHART 2: CACHE HIT RATIO OVER TIME
// ==========================================
function CacheHitRatioD3Chart({
  data,
  theme,
}: {
  data: SqliteHealthSnapshot[];
  theme: 'light' | 'dark';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = useContainerWidth(containerRef, 480);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    point: SqliteHealthSnapshot;
  } | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || data.length === 0) return;

    const height = 210;
    const margin = { top: 14, right: 16, bottom: 28, left: 44 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const extent = d3.extent(data, (d) => d.timestampMs) as [number, number];
    const minT = extent[0] === extent[1] ? extent[0] - 10000 : extent[0];
    const maxT = extent[0] === extent[1] ? extent[1] + 10000 : extent[1];

    const x = d3.scaleTime().domain([new Date(minT), new Date(maxT)]).range([0, innerW]);

    const minRatio = d3.min(data, (d) => Math.min(d.cacheHitRatio, d.workingSetFitPct)) ?? 50;
    const yMin = Math.max(0, Math.floor((minRatio - 10) / 10) * 10);
    const y = d3.scaleLinear().domain([yMin, 100]).range([innerH, 0]);

    const gridColor = theme === 'light' ? '#e4e4e7' : '#1e293b';
    const textColor = theme === 'light' ? '#52525b' : '#94a3b8';

    g.append('g')
      .selectAll('line')
      .data(y.ticks(4))
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3 3');

    const defs = svg.append('defs');
    const hitGrad = defs
      .append('linearGradient')
      .attr('id', 'cache-hit-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    hitGrad.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.34);
    hitGrad.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.02);

    const hitArea = d3
      .area<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y0(innerH)
      .y1((d) => y(d.cacheHitRatio))
      .curve(d3.curveMonotoneX);

    const hitLine = d3
      .line<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y((d) => y(d.cacheHitRatio))
      .curve(d3.curveMonotoneX);

    const fitLine = d3
      .line<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y((d) => y(d.workingSetFitPct))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(data).attr('fill', 'url(#cache-hit-grad)').attr('d', hitArea);
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#0ea5e9')
      .attr('stroke-width', 1.6)
      .attr('stroke-dasharray', '4 3')
      .attr('d', fitLine);
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2.2)
      .attr('d', hitLine);

    g.selectAll('.dot-hit')
      .data(data)
      .join('circle')
      .attr('cx', (d) => x(new Date(d.timestampMs)))
      .attr('cy', (d) => y(d.cacheHitRatio))
      .attr('r', 2.5)
      .attr('fill', '#10b981');

    const xAxis = d3
      .axisBottom(x)
      .ticks(Math.min(5, data.length))
      .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date));
    const yAxis = d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}%`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').attr('stroke', gridColor))
      .call((sel) => sel.selectAll('text').attr('fill', textColor).style('font-size', '10px').style('font-family', 'monospace'));

    g.append('g')
      .call(yAxis)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('line').remove())
      .call((sel) => sel.selectAll('text').attr('fill', textColor).style('font-size', '10px').style('font-family', 'monospace'));

    const bisect = d3.bisector<SqliteHealthSnapshot, Date>((d) => new Date(d.timestampMs)).left;
    const crosshair = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', theme === 'light' ? '#71717a' : '#94a3b8')
      .attr('stroke-dasharray', '3 3')
      .style('opacity', 0);

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const hoveredDate = x.invert(mx);
        const idx = Math.min(data.length - 1, Math.max(0, bisect(data, hoveredDate, 0)));
        const d0 = data[Math.max(0, idx - 1)];
        const d1 = data[idx];
        const chosen =
          d0 && hoveredDate.getTime() - d0.timestampMs < d1.timestampMs - hoveredDate.getTime()
            ? d0
            : d1;
        const cx = x(new Date(chosen.timestampMs));
        crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 0.8);
        setHoverInfo({ x: margin.left + cx, point: chosen });
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        setHoverInfo(null);
      });
  }, [data, width, theme]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} className="w-full h-[210px] overflow-visible" />
      {hoverInfo && (
        <div
          className={`pointer-events-none absolute top-2 z-20 px-2.5 py-1.5 rounded-lg border font-mono text-[10px] shadow-md ${
            theme === 'light'
              ? 'bg-white/95 border-zinc-300 text-zinc-900'
              : 'bg-slate-950/95 border-slate-700 text-slate-100'
          }`}
          style={{
            left: hoverInfo.x > width * 0.6 ? Math.max(8, hoverInfo.x - 168) : hoverInfo.x + 12,
          }}
        >
          <p className="font-bold text-emerald-500 mb-0.5">{hoverInfo.point.timestamp}</p>
          <p>Cache Hit Ratio: {hoverInfo.point.cacheHitRatio}%</p>
          <p>
            Lookups: {hoverInfo.point.cacheHits} hits / {hoverInfo.point.cacheMisses} misses
          </p>
          <p>Working Set Fit: {hoverInfo.point.workingSetFitPct}%</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// D3 CHART 3A: INDEX HEALTH TREND OVER TIME
// ==========================================
function IndexHealthTrendD3Chart({
  data,
  theme,
}: {
  data: SqliteHealthSnapshot[];
  theme: 'light' | 'dark';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = useContainerWidth(containerRef, 480);
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    point: SqliteHealthSnapshot;
  } | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || data.length === 0) return;

    const height = 195;
    const margin = { top: 14, right: 16, bottom: 28, left: 42 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const extent = d3.extent(data, (d) => d.timestampMs) as [number, number];
    const minT = extent[0] === extent[1] ? extent[0] - 10000 : extent[0];
    const maxT = extent[0] === extent[1] ? extent[1] + 10000 : extent[1];

    const x = d3.scaleTime().domain([new Date(minT), new Date(maxT)]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    const gridColor = theme === 'light' ? '#e4e4e7' : '#1e293b';
    const textColor = theme === 'light' ? '#52525b' : '#94a3b8';

    g.append('g')
      .selectAll('line')
      .data([25, 50, 75, 100])
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', gridColor)
      .attr('stroke-dasharray', '3 3');

    // Optimal threshold line at 80
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(80))
      .attr('y2', y(80))
      .attr('stroke', '#10b981')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', '4 4');

    const defs = svg.append('defs');
    const idxGrad = defs
      .append('linearGradient')
      .attr('id', 'index-health-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    idxGrad.append('stop').attr('offset', '0%').attr('stop-color', '#f97316').attr('stop-opacity', 0.34);
    idxGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f97316').attr('stop-opacity', 0.02);

    const area = d3
      .area<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y0(innerH)
      .y1((d) => y(d.indexHealthScore))
      .curve(d3.curveMonotoneX);

    const line = d3
      .line<SqliteHealthSnapshot>()
      .x((d) => x(new Date(d.timestampMs)))
      .y((d) => y(d.indexHealthScore))
      .curve(d3.curveMonotoneX);

    g.append('path').datum(data).attr('fill', 'url(#index-health-grad)').attr('d', area);
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#f97316')
      .attr('stroke-width', 2.2)
      .attr('d', line);

    g.selectAll('.dot-idx')
      .data(data)
      .join('circle')
      .attr('cx', (d) => x(new Date(d.timestampMs)))
      .attr('cy', (d) => y(d.indexHealthScore))
      .attr('r', 2.5)
      .attr('fill', '#f97316');

    const xAxis = d3
      .axisBottom(x)
      .ticks(Math.min(5, data.length))
      .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date));
    const yAxis = d3.axisLeft(y).tickValues([0, 25, 50, 75, 100]);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').attr('stroke', gridColor))
      .call((sel) => sel.selectAll('text').attr('fill', textColor).style('font-size', '10px').style('font-family', 'monospace'));

    g.append('g')
      .call(yAxis)
      .call((sel) => sel.select('.domain').remove())
      .call((sel) => sel.selectAll('line').remove())
      .call((sel) => sel.selectAll('text').attr('fill', textColor).style('font-size', '10px').style('font-family', 'monospace'));

    const bisect = d3.bisector<SqliteHealthSnapshot, Date>((d) => new Date(d.timestampMs)).left;
    const crosshair = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', theme === 'light' ? '#71717a' : '#94a3b8')
      .attr('stroke-dasharray', '3 3')
      .style('opacity', 0);

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event);
        const hoveredDate = x.invert(mx);
        const idx = Math.min(data.length - 1, Math.max(0, bisect(data, hoveredDate, 0)));
        const d0 = data[Math.max(0, idx - 1)];
        const d1 = data[idx];
        const chosen =
          d0 && hoveredDate.getTime() - d0.timestampMs < d1.timestampMs - hoveredDate.getTime()
            ? d0
            : d1;
        const cx = x(new Date(chosen.timestampMs));
        crosshair.attr('x1', cx).attr('x2', cx).style('opacity', 0.8);
        setHoverInfo({ x: margin.left + cx, point: chosen });
      })
      .on('mouseleave', () => {
        crosshair.style('opacity', 0);
        setHoverInfo(null);
      });
  }, [data, width, theme]);

  return (
    <div ref={containerRef} className="relative w-full">
      <svg ref={svgRef} className="w-full h-[195px] overflow-visible" />
      {hoverInfo && (
        <div
          className={`pointer-events-none absolute top-2 z-20 px-2.5 py-1.5 rounded-lg border font-mono text-[10px] shadow-md ${
            theme === 'light'
              ? 'bg-white/95 border-zinc-300 text-zinc-900'
              : 'bg-slate-950/95 border-slate-700 text-slate-100'
          }`}
          style={{
            left: hoverInfo.x > width * 0.6 ? Math.max(8, hoverInfo.x - 160) : hoverInfo.x + 12,
          }}
        >
          <p className="font-bold text-orange-500 mb-0.5">{hoverInfo.point.timestamp}</p>
          <p>Index Health: {hoverInfo.point.indexHealthScore} / 100</p>
          <p>DB Size: {formatBytes(hoverInfo.point.sizeBytes)}</p>
        </div>
      )}
    </div>
  );
}

// ==========================================
// D3 CHART 3B: TABLE & INDEX B-TREE FILL BAR CHART
// ==========================================
function TableIndexFillD3Chart({
  entries,
  theme,
}: {
  entries: SqliteDbStatEntry[];
  theme: 'light' | 'dark';
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const width = useContainerWidth(containerRef, 480);

  const chartHeight = Math.max(150, entries.length * 34 + 28);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || entries.length === 0) return;

    const margin = { top: 8, right: 64, bottom: 20, left: 155 };
    const innerW = Math.max(100, width - margin.left - margin.right);
    const innerH = Math.max(80, chartHeight - margin.top - margin.bottom);

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const g = svg
      .attr('viewBox', `0 0 ${width} ${chartHeight}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3
      .scaleBand()
      .domain(entries.map((e) => e.name))
      .range([0, innerH])
      .padding(0.32);

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);

    const trackColor = theme === 'light' ? '#e4e4e7' : '#1e293b';
    const labelColor = theme === 'light' ? '#27272a' : '#e2e8f0';
    const mutedColor = theme === 'light' ? '#71717a' : '#94a3b8';

    // Background slack bars (100% allocated)
    g.selectAll('.bar-track')
      .data(entries)
      .join('rect')
      .attr('x', 0)
      .attr('y', (d) => y(d.name) ?? 0)
      .attr('width', innerW)
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('fill', trackColor);

    // Used B-tree payload bars
    g.selectAll('.bar-used')
      .data(entries)
      .join('rect')
      .attr('x', 0)
      .attr('y', (d) => y(d.name) ?? 0)
      .attr('width', (d) => Math.max(2, x(d.fillFactorPct)))
      .attr('height', y.bandwidth())
      .attr('rx', 4)
      .attr('fill', (d) =>
        d.kind === 'index'
          ? '#f97316'
          : d.status === 'Optimal'
          ? '#10b981'
          : d.status === 'Fair'
          ? '#f59e0b'
          : '#ef4444'
      );

    // Left object name labels
    g.selectAll('.row-label')
      .data(entries)
      .join('text')
      .attr('x', -8)
      .attr('y', (d) => (y(d.name) ?? 0) + y.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', labelColor)
      .style('font-size', '10.5px')
      .style('font-family', 'monospace')
      .text((d) => (d.name.length > 20 ? `${d.name.slice(0, 19)}…` : d.name));

    // Right percentage labels
    g.selectAll('.val-label')
      .data(entries)
      .join('text')
      .attr('x', innerW + 8)
      .attr('y', (d) => (y(d.name) ?? 0) + y.bandwidth() / 2 + 4)
      .attr('fill', mutedColor)
      .style('font-size', '10px')
      .style('font-family', 'monospace')
      .text((d) => `${d.fillFactorPct}%`);

    const xAxis = d3.axisBottom(x).tickValues([0, 25, 50, 75, 100]).tickFormat((d) => `${d}%`);
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((sel) => sel.select('.domain').attr('stroke', trackColor))
      .call((sel) => sel.selectAll('text').attr('fill', mutedColor).style('font-size', '9.5px').style('font-family', 'monospace'));
  }, [entries, width, chartHeight, theme]);

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} style={{ height: `${chartHeight}px` }} className="w-full overflow-visible" />
    </div>
  );
}

// ==========================================
// MAIN COMPONENT: SQLITE DATABASE HEALTH TAB
// ==========================================
export default function SqliteDatabaseHealth({
  theme,
  refreshTrigger = 0,
  onAfterCompact,
}: SqliteDatabaseHealthProps) {
  const [report, setReport] = useState<SqliteHealthReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCompacting, setIsCompacting] = useState<boolean>(false);
  const [autoSample, setAutoSample] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async (recordSample = true) => {
    try {
      const res = await fetch(`/api/database/health?sample=${recordSample ? 'true' : 'false'}`);
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `Failed to load database health (HTTP ${res.status})`);
      }
      setReport(payload);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to collect SQLite health telemetry.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth(true);
  }, [fetchHealth, refreshTrigger]);

  useEffect(() => {
    if (!autoSample) return;
    const timer = setInterval(() => {
      fetchHealth(true);
    }, 4500);
    return () => clearInterval(timer);
  }, [autoSample, fetchHealth]);

  const handleCompactAndOptimize = async () => {
    if (isCompacting) return;
    setIsCompacting(true);
    try {
      const res = await fetch('/api/database/compact', { method: 'POST' });
      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload?.error || 'Compaction failed.');
      }
      await fetchHealth(true);
      await Promise.resolve(onAfterCompact?.());
    } catch (err: any) {
      setError(err?.message || 'Failed to compact database.');
    } finally {
      setIsCompacting(false);
    }
  };

  if (isLoading && !report) {
    return (
      <div
        className={`border rounded-xl p-8 text-center font-mono text-xs ${
          theme === 'light'
            ? 'bg-white border-zinc-200 text-zinc-500'
            : 'bg-slate-900/50 border-slate-800 text-slate-400'
        }`}
      >
        Collecting SQLite dbstat &amp; page-cache diagnostics...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div
        className={`border rounded-xl p-5 flex items-start justify-between gap-4 flex-wrap ${
          theme === 'light'
            ? 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
            : 'bg-slate-900/50 border-slate-800 text-slate-100'
        }`}
      >
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-orange-500 shrink-0" />
            <h3 className="text-base font-bold font-display tracking-tight">
              Database Health Diagnostics
            </h3>
          </div>
          {report && (
            <div
              className={`flex items-center gap-2 text-xs font-mono tabular-nums flex-wrap ${
                theme === 'light' ? 'text-zinc-600' : 'text-slate-400'
              }`}
            >
              <span>quick_check: {report.integrity.quickCheck.toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span>Journal: {report.integrity.journalMode}</span>
              <span aria-hidden="true">·</span>
              <span>Auto-Vacuum: {report.integrity.autoVacuumMode}</span>
              <span aria-hidden="true">·</span>
              <span>Cache Budget: {report.integrity.cacheSizeKiB} KiB</span>
              <span aria-hidden="true">·</span>
              <span>Page Size: {report.integrity.pageSize} B</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setAutoSample((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              autoSample
                ? theme === 'light'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : theme === 'light'
                ? 'bg-white border-zinc-300 text-zinc-700'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            {autoSample ? 'Auto-Sample: ON' : 'Auto-Sample: OFF'}
          </button>

          <button
            type="button"
            onClick={() => fetchHealth(true)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              theme === 'light'
                ? 'bg-white hover:bg-zinc-50 border-zinc-300 text-zinc-700'
                : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-200'
            }`}
          >
            <RefreshCw size={12} />
            Sample Now
          </button>

          <button
            type="button"
            onClick={handleCompactAndOptimize}
            disabled={isCompacting}
            className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Minimize2 size={12} />
            {isCompacting ? 'Compacting...' : 'Compact & Optimize'}
          </button>
        </div>
      </div>

      {error && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono ${
            theme === 'light'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-rose-950/25 border-rose-500/30 text-rose-300'
          }`}
        >
          {error}
        </div>
      )}

      {report && (
        <>
          {/* 4-Column KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`border rounded-xl p-4 space-y-1 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <p className="text-[11px] font-medium opacity-70 flex items-center gap-1.5">
                <HardDrive size={12} className="text-amber-500" />
                Freelist Fragmentation
              </p>
              <p className="text-xl font-bold font-mono tabular-nums">
                {report.current.freelistFragPct}%
              </p>
              <p className="text-[11px] font-mono tabular-nums opacity-65">
                {report.current.freelistCount} free / {report.current.pageCount} pages
              </p>
            </div>

            <div
              className={`border rounded-xl p-4 space-y-1 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <p className="text-[11px] font-medium opacity-70 flex items-center gap-1.5">
                <Database size={12} className="text-indigo-500" />
                B-Tree Unused Slack
              </p>
              <p className="text-xl font-bold font-mono tabular-nums">
                {report.current.btreeUnusedPct}%
              </p>
              <p className="text-[11px] font-mono tabular-nums opacity-65">
                DB File: {formatBytes(report.current.sizeBytes)}
              </p>
            </div>

            <div
              className={`border rounded-xl p-4 space-y-1 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <p className="text-[11px] font-medium opacity-70 flex items-center gap-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                Cache Hit Ratio
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {report.current.cacheHitRatio}%
              </p>
              <p className="text-[11px] font-mono tabular-nums opacity-65">
                {report.current.cacheHits} hits · {report.current.cacheMisses} misses
              </p>
            </div>

            <div
              className={`border rounded-xl p-4 space-y-1 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <p className="text-[11px] font-medium opacity-70 flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-orange-500" />
                Index Health Score
              </p>
              <p className="text-xl font-bold font-mono tabular-nums text-orange-500">
                {report.current.indexHealthScore} / 100
              </p>
              <p className="text-[11px] font-mono tabular-nums opacity-65">
                {report.tablesAndIndexes.length} B-tree objects tracked
              </p>
            </div>
          </div>

          {/* D3 Time-Series Charts Row: Page Fragmentation & Cache Hit Ratio */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div
              className={`border rounded-xl p-4 space-y-3 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-sm font-semibold">Page Fragmentation Over Time</h4>
                  <p className="text-[11px] opacity-65">
                    Freelist ratio vs. interior B-tree slack via SQLite dbstat
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-amber-500 inline-block" />
                    Freelist %
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-indigo-500 inline-block" />
                    B-Tree Slack %
                  </span>
                </div>
              </div>
              <FragmentationD3Chart data={report.history} theme={theme} />
            </div>

            <div
              className={`border rounded-xl p-4 space-y-3 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-sm font-semibold">Page Cache Hit Ratio Over Time</h4>
                  <p className="text-[11px] opacity-65">
                    Buffer cache hits vs. working-set fit within {report.integrity.cacheSizeKiB} KiB
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" />
                    Hit Ratio %
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-sky-500 inline-block" />
                    Cache Fit %
                  </span>
                </div>
              </div>
              <CacheHitRatioD3Chart data={report.history} theme={theme} />
            </div>
          </div>

          {/* D3 Table & Index Health Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div
              className={`border rounded-xl p-4 space-y-3 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-sm font-semibold">Table &amp; Index Health Over Time</h4>
                  <p className="text-[11px] opacity-65">
                    Composite index fill factor and freelist penalty score (80+ Optimal)
                  </p>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-orange-500 font-semibold">
                  Current: {report.current.indexHealthScore}/100
                </span>
              </div>
              <IndexHealthTrendD3Chart data={report.history} theme={theme} />
            </div>

            <div
              className={`border rounded-xl p-4 space-y-3 ${
                theme === 'light'
                  ? 'bg-white border-zinc-200'
                  : 'bg-slate-900/50 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h4 className="text-sm font-semibold">B-Tree Page Fill Factor by Object</h4>
                  <p className="text-[11px] opacity-65">
                    Used payload vs. allocated page space per table &amp; index
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                    Table
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-xs bg-orange-500 inline-block" />
                    Index
                  </span>
                </div>
              </div>
              <TableIndexFillD3Chart entries={report.tablesAndIndexes} theme={theme} />
            </div>
          </div>

          {/* Detailed Table & Index Health Ledger */}
          <div
            className={`border rounded-xl overflow-hidden ${
              theme === 'light'
                ? 'bg-white border-zinc-200'
                : 'bg-slate-900/50 border-slate-800'
            }`}
          >
            <div
              className={`px-4 py-3 border-b flex items-center justify-between ${
                theme === 'light' ? 'border-zinc-200' : 'border-slate-800'
              }`}
            >
              <h4 className="text-xs font-semibold uppercase tracking-wider font-mono">
                SQLite Object Health Ledger (dbstat)
              </h4>
              <span className="text-[11px] font-mono opacity-65 tabular-nums">
                {report.tablesAndIndexes.length} objects inspected
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead
                  className={`border-b ${
                    theme === 'light'
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-600'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400'
                  }`}
                >
                  <tr>
                    <th className="px-4 py-2 font-semibold">Object Name</th>
                    <th className="px-4 py-2 font-semibold">Kind</th>
                    <th className="px-4 py-2 font-semibold text-right">Pages</th>
                    <th className="px-4 py-2 font-semibold text-right">Cells</th>
                    <th className="px-4 py-2 font-semibold text-right">Used / Total</th>
                    <th className="px-4 py-2 font-semibold text-right">Fill Factor</th>
                    <th className="px-4 py-2 font-semibold text-right">Health Score</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody
                  className={`divide-y ${
                    theme === 'light' ? 'divide-zinc-100' : 'divide-slate-800/70'
                  }`}
                >
                  {report.tablesAndIndexes.map((entry) => (
                    <tr
                      key={entry.name}
                      className={
                        theme === 'light' ? 'hover:bg-zinc-50' : 'hover:bg-slate-800/30'
                      }
                    >
                      <td className="px-4 py-2 font-semibold">{entry.name}</td>
                      <td className="px-4 py-2 uppercase opacity-75">{entry.kind}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{entry.pages}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{entry.cells}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatBytes(entry.usedBytes)} / {formatBytes(entry.totalBytes)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{entry.fillFactorPct}%</td>
                      <td className="px-4 py-2 text-right tabular-nums font-bold">
                        {entry.healthScore}
                      </td>
                      <td
                        className={`px-4 py-2 font-semibold ${
                          entry.status === 'Optimal'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : entry.status === 'Fair'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {entry.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
