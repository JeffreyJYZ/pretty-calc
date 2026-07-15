import * as React from "react";
import { type AngleMode, tryEvaluate } from "../lib/calc";

type GraphPanelProps = {
	angleMode: AngleMode;
};

// Evaluate an expression with x substituted by inserting "(x)" at the cursor.
// We compile by replacing variable `x` with the numeric value (wrapped).
function compileFn(
	expr: string,
	angleMode: AngleMode,
): (x: number) => number | null {
	// Encode 'x' as a value-bearing token: wrap parens around it.
	return (x: number) => {
		// Replace standalone `x` tokens.
		const substituted = expr.replace(
			/(^|[+\-*/^(),%!\s])x(?=$|[+\-*/^(),%!\s])/g,
			(_, pre, _post) => `${pre}(${x})`,
		);
		return tryEvaluate(substituted, { angleMode, ans: 0 });
	};
}

export function GraphPanel({ angleMode }: GraphPanelProps) {
	const [expr, setExpr] = React.useState<string>("sin(x)");
	const [range, setRange] = React.useState<number>(10);
	const [err, setErr] = React.useState<string | null>(null);
	const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
	const containerRef = React.useRef<HTMLDivElement | null>(null);
	const [size, setSize] = React.useState<{ w: number; h: number }>({
		w: 320,
		h: 240,
	});

	// Track container size so canvas resizes responsively.
	React.useLayoutEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const ro = new ResizeObserver((entries) => {
			const e = entries[0];
			if (e) {
				const w = Math.max(160, Math.floor(e.contentRect.width));
				const h = Math.max(160, Math.floor(w * 0.6));
				setSize({ w, h });
			}
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const fn = React.useMemo(
		() => compileFn(expr, angleMode),
		[expr, angleMode],
	);

	// Sample to know y range.
	const yBounds = React.useMemo<{ lo: number; hi: number }>(() => {
		let lo = Number.POSITIVE_INFINITY;
		let hi = Number.NEGATIVE_INFINITY;
		const samples = 200;
		for (let i = 0; i <= samples; i++) {
			const x = -range + (2 * range * i) / samples;
			const y = fn(x);
			if (y === null || !Number.isFinite(y)) continue;
			if (y < lo) lo = y;
			if (y > hi) hi = y;
		}
		if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
			lo = -5;
			hi = 5;
		}
		// Add padding + symmetric guards.
		const pad = (hi - lo) * 0.1 || 1;
		lo -= pad;
		hi += pad;
		if (hi - lo < 1e-6) {
			lo -= 0.5;
			hi += 0.5;
		}
		return { lo, hi: hi === lo ? lo + 1 : hi };
	}, [fn, range]);

	React.useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = size.w * dpr;
		canvas.height = size.h * dpr;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, size.w, size.h);

		const { w, h } = size;
		const { lo, hi } = yBounds;
		const xLo = -range;
		const xHi = range;

		const toPxX = (x: number) => ((x - xLo) / (xHi - xLo)) * w;
		const toPxY = (y: number) => h - ((y - lo) / (hi - lo)) * h;

		// Background
		ctx.fillStyle = "#0d1614";
		ctx.fillRect(0, 0, w, h);

		// Grid
		ctx.strokeStyle = "#1c2624";
		ctx.lineWidth = 1;
		ctx.beginPath();
		const xStep = niceStep(range * 2);
		for (let g = Math.ceil(xLo / xStep) * xStep; g <= xHi; g += xStep) {
			const px = toPxX(g);
			ctx.moveTo(px, 0);
			ctx.lineTo(px, h);
		}
		const yStep = niceStep(hi - lo);
		for (let g = Math.ceil(lo / yStep) * yStep; g <= hi; g += yStep) {
			const py = toPxY(g);
			ctx.moveTo(0, py);
			ctx.lineTo(w, py);
		}
		ctx.stroke();

		// Axes
		ctx.strokeStyle = "#445550";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		if (xLo <= 0 && xHi >= 0) {
			const px = toPxX(0);
			ctx.moveTo(px, 0);
			ctx.lineTo(px, h);
		}
		if (lo <= 0 && hi >= 0) {
			const py = toPxY(0);
			ctx.moveTo(0, py);
			ctx.lineTo(w, py);
		}
		ctx.stroke();

		// Plot
		ctx.strokeStyle = "#6fb8a4";
		ctx.lineWidth = 2;
		ctx.beginPath();
		let moved = false;
		const samples = 600;
		for (let i = 0; i <= samples; i++) {
			const x = xLo + ((xHi - xLo) * i) / samples;
			const y = fn(x);
			if (y === null || !Number.isFinite(y)) {
				moved = false;
				continue;
			}
			const px = toPxX(x);
			const py = toPxY(y);
			if (!moved) {
				ctx.moveTo(px, py);
				moved = true;
			} else {
				ctx.lineTo(px, py);
			}
		}
		ctx.stroke();

		// Axis labels
		ctx.fillStyle = "#6f8a83";
		ctx.font = "10px ui-monospace, monospace";
		ctx.fillText(
			`x: ${formatTick(-range)} .. ${formatTick(range)}`,
			6,
			h - 6,
		);
		ctx.fillText(`y: ${formatTick(lo)} .. ${formatTick(hi)}`, 6, 12);
	}, [fn, size, yBounds, range]);

	function handleExpr(e: React.ChangeEvent<HTMLInputElement>) {
		const v = e.currentTarget.value;
		setExpr(v);
		const test = compileFn(v, angleMode)(1);
		setErr(test === null && v.trim() ? "Invalid expression" : null);
	}

	return (
		<section className="sci-panel graph" aria-label="Graph view">
			<div className="graph-controls">
				<div className="graph-input-wrap">
					<span className="graph-prefix">y =</span>
					<input
						type="text"
						value={expr}
						onChange={handleExpr}
						className="graph-input"
						placeholder="sin(x)"
						spellCheck={false}
						autoCapitalize="off"
						autoCorrect="off"
						aria-label="Expression in terms of x"
					/>
				</div>
				<label className="graph-range">
					<span>±x</span>
					<input
						type="range"
						min={1}
						max={30}
						step={0.5}
						value={range}
						onChange={(e) =>
							setRange(Number(e.currentTarget.value))
						}
						aria-label="X axis range"
					/>
					<span className="graph-range-val">{range}</span>
				</label>
			</div>
			{err && <div className="graph-err">{err}</div>}
			<div ref={containerRef} className="graph-canvas-wrap">
				<canvas
					ref={canvasRef}
					style={{ width: size.w, height: size.h }}
					aria-label="Graph plot"
				/>
			</div>
			<p className="graph-hint">
				Use x as the variable. Examples: sin(x), x^2 - 4, 1/x, e^x,
				ln(x).
			</p>
		</section>
	);
}

function niceStep(span: number): number {
	if (span <= 0) return 1;
	const pow = 10 ** Math.floor(Math.log10(span / 5));
	const norm = span / 5 / pow;
	let step = 0;
	if (norm < 1.5) step = 1;
	else if (norm < 3) step = 2;
	else if (norm < 7) step = 5;
	else step = 10;
	return step * pow;
}

function formatTick(v: number): string {
	if (Math.abs(v) >= 1000) return v.toExponential(2);
	const r = Number.parseFloat(v.toPrecision(6));
	return String(r);
}
