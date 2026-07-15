import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import * as React from "react";
import {
	type AngleMode,
	CalcError,
	type EvalOptions,
	evaluate,
	formatResult,
	tryEvaluate,
} from "../lib/calc";
import { BaseNPanel } from "./BaseNPanel";
import { ConverterPanel } from "./ConverterPanel";
import { GraphPanel } from "./GraphPanel";
import type { KeyColor } from "./Key";
import { Key } from "./Key";
import "../App.css";

const MODES: Mode[] = ["basic", "base-n", "convert", "graph"];
const MODE_LABEL: Record<Mode, string> = {
	basic: "Calc",
	"base-n": "Base-N",
	convert: "Convert",
	graph: "Graph",
};
function nextMode(m: Mode): Mode {
	return MODES[(MODES.indexOf(m) + 1) % MODES.length];
}

const TAURI_AVAILABLE =
	typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const STORE_FILE = "pretty-calc.json";
const STORE_KEY = "state";

let storePromise: Promise<Awaited<ReturnType<typeof load>>> | null = null;
function getStore() {
	if (!storePromise) {
		storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
	}
	return storePromise;
}

type Persisted = {
	history: HistoryEntry[];
	ans: number;
	mem: number;
	angleMode: AngleMode;
	mode: Mode;
	showSci: boolean;
};

async function loadState(): Promise<Partial<Persisted>> {
	if (typeof window === "undefined") return {};
	try {
		if (TAURI_AVAILABLE) {
			const store = await getStore();
			const raw = (await store.get(STORE_KEY)) as string | null;
			if (!raw) return {};
			const parsed = JSON.parse(raw) as Persisted;
			if (!parsed || typeof parsed !== "object") return {};
			if (!Array.isArray(parsed.history)) parsed.history = [];
			return parsed;
		}
		const raw = window.localStorage.getItem(STORE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Persisted;
		if (!parsed || typeof parsed !== "object") return {};
		if (!Array.isArray(parsed.history)) parsed.history = [];
		return parsed;
	} catch {
		return {};
	}
}

async function saveState(state: Persisted): Promise<void> {
	if (typeof window === "undefined") return;
	try {
		if (TAURI_AVAILABLE) {
			const store = await getStore();
			await store.set(STORE_KEY, JSON.stringify(state));
			await store.save();
			return;
		}
		window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
	} catch {
		// storage full or unavailable — silently skip
	}
}

type Mode = "basic" | "base-n" | "convert" | "graph";

type HistoryEntry = {
	id: number;
	expr: string;
	result: string;
};

type KeyDef = {
	label: React.ReactNode;
	insert?: string;
	action?: "equals" | "clear" | "del";
	color?: KeyColor;
	aria?: string;
	title?: string;
};

function append(left: string, ins: string): string {
	return left + ins;
}

type TrigBase = "sin" | "cos" | "tan";
type TrigName =
	| "sin"
	| "cos"
	| "tan"
	| "sinh"
	| "cosh"
	| "tanh"
	| "asin"
	| "acos"
	| "atan"
	| "asinh"
	| "acosh"
	| "atanh";

function trigFor(
	shift: boolean,
	hyp: boolean,
	base: TrigBase,
): {
	name: TrigName;
	label: string;
	ins: string;
} {
	let name: TrigName = base;
	if (hyp && base === "sin") name = "sinh";
	if (hyp && base === "cos") name = "cosh";
	if (hyp && base === "tan") name = "tanh";
	if (shift && base === "sin") name = hyp ? "asinh" : "asin";
	if (shift && base === "cos") name = hyp ? "acosh" : "acos";
	if (shift && base === "tan") name = hyp ? "atanh" : "atan";
	const prefix = shift ? "arc" : "";
	const label = `${prefix}${base}`;
	return { name, label, ins: `${name}(` };
}

export function Calculator() {
	const [expr, setExpr] = React.useState<string>("");
	const [ans, setAns] = React.useState<number>(0);
	const [angleMode, setAngleMode] = React.useState<AngleMode>("DEG");
	const [mode, setMode] = React.useState<Mode>("basic");
	const [shift2nd, setShift2nd] = React.useState<boolean>(false);
	const [hyp, setHyp] = React.useState<boolean>(false);
	const [mem, setMem] = React.useState<number>(0);
	const [history, setHistory] = React.useState<HistoryEntry[]>([]);
	const [showHistory, setShowHistory] = React.useState<boolean>(false);
	const [showSci, setShowSci] = React.useState<boolean>(false);
	const [error, setError] = React.useState<string | null>(null);
	const [justEvaluated, setJustEvaluated] = React.useState<boolean>(false);
	const [loaded, setLoaded] = React.useState<boolean>(false);

	React.useEffect(() => {
		let cancelled = false;
		void loadState().then((p) => {
			if (cancelled) return;
			if (typeof p.ans === "number") setAns(p.ans);
			if (p.angleMode) setAngleMode(p.angleMode);
			if (p.mode) setMode(p.mode);
			if (typeof p.mem === "number") setMem(p.mem);
			if (Array.isArray(p.history)) setHistory(p.history);
			if (typeof p.showSci === "boolean") setShowSci(p.showSci);
			setLoaded(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		if (!loaded) return;
		void saveState({ history, ans, mem, angleMode, mode, showSci });
	}, [loaded, history, ans, mem, angleMode, mode, showSci]);

	const opts: EvalOptions = React.useMemo(
		() => ({ angleMode, ans }),
		[angleMode, ans],
	);

	const preview = React.useMemo<number | null>(() => {
		if (!expr.trim()) return justEvaluated ? ans : null;
		return tryEvaluate(expr, opts);
	}, [expr, opts, justEvaluated, ans]);

	function insert(token: string) {
		setError(null);
		setExpr((prev) => {
			if (justEvaluated) {
				const isValueStart =
					/^[\d.(]/.test(token) ||
					token === "pi" ||
					token === "e" ||
					token === "ans";
				if (isValueStart) return token;
				return formatResult(ans) + token;
			}
			return append(prev, token);
		});
		setJustEvaluated(false);
	}

	async function doEquals() {
		const input = expr.trim();
		if (!input) return;
		// Hybrid: prefer Rust for committed `=` (exact f64, no double-parse),
		// fall back to TS engine if Tauri bridge unavailable (pure web build).
		let pretty: string;
		let result: number;
		if (TAURI_AVAILABLE) {
			try {
				const out = (await invoke("calc_eval", {
					expr: input,
					angle: angleMode,
					ans,
				})) as string;
				if (out.startsWith("__err__:")) {
					setError(out.slice(7) || "Error");
					return;
				}
				pretty = out;
				// Parse the same formatted string for Ans continuity.
				result = Number.parseFloat(out);
			} catch {
				setError("Engine unavailable");
				return;
			}
		} else {
			try {
				result = evaluate(input, opts);
				pretty = formatResult(result);
			} catch (e) {
				setError(e instanceof CalcError ? e.message : "Error");
				return;
			}
		}
		if (!Number.isFinite(result)) {
			setError("Error");
			return;
		}
		setAns(result);
		setHistory((h) =>
			[{ id: Date.now(), expr: input, result: pretty }, ...h].slice(
				0,
				100,
			),
		);
		setExpr(pretty);
		setJustEvaluated(true);
		setError(null);
	}

	function doBackspace() {
		setError(null);
		setExpr((prev) => (justEvaluated ? "" : prev.slice(0, -1)));
		setJustEvaluated(false);
	}

	function doClear() {
		setExpr("");
		setError(null);
		setJustEvaluated(false);
	}

	const mPlus = () => {
		const v = tryEvaluate(expr, opts) ?? (justEvaluated ? ans : 0);
		setMem((m) => m + v);
	};
	const mMinus = () => {
		const v = tryEvaluate(expr, opts) ?? (justEvaluated ? ans : 0);
		setMem((m) => m - v);
	};
	const mRecall = () => insert(formatResult(mem));
	const mClear = () => setMem(0);

	function reuse(entry: HistoryEntry, kind: "expr" | "result") {
		const val = kind === "expr" ? entry.expr : entry.result;
		setError(null);
		setExpr((prev) => (justEvaluated ? val : prev + val));
		setJustEvaluated(false);
	}

	function clearHistory() {
		setHistory([]);
	}

	const keyHandlerRef = React.useRef<(e: KeyboardEvent) => void>(() => {});
	keyHandlerRef.current = (e: KeyboardEvent) => {
		const target = e.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === "INPUT" || target.tagName === "TEXTAREA")
		)
			return;
		const k = e.key;
		if ((k >= "0" && k <= "9") || k === ".") {
			insert(k);
			e.preventDefault();
		} else if (
			k === "+" ||
			k === "-" ||
			k === "*" ||
			k === "/" ||
			k === "^"
		) {
			insert(k);
			e.preventDefault();
		} else if (k === "(" || k === ")") {
			insert(k);
			e.preventDefault();
		} else if (k === "%" || k === "!") {
			insert(k);
			e.preventDefault();
		} else if (k === "Enter" || k === "=") {
			void doEquals();
			e.preventDefault();
		} else if (k === "Backspace") {
			doBackspace();
			e.preventDefault();
		} else if (k === "Escape" || k === "Delete") {
			doClear();
			e.preventDefault();
		}
	};

	React.useEffect(() => {
		const handler = (e: KeyboardEvent) => keyHandlerRef.current(e);
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	const display = (() => {
		if (error) return { kind: "err", text: error } as const;
		if (preview === null) {
			if (!expr.trim()) return { kind: "idle", text: "0" } as const;
			return { kind: "idle", text: expr } as const;
		}
		return { kind: "ok", text: formatResult(preview) } as const;
	})();

	const digitKeys: KeyDef[] = [
		{ label: "AC", action: "clear", color: "clr", aria: "All clear" },
		{ label: "DEL", action: "del", color: "clr", aria: "Delete last" },
		{ label: "%", insert: "%", color: "op", title: "Percent" },
		{ label: "\u00f7", insert: "/", color: "op", aria: "Divide" },
		{ label: "7", insert: "7" },
		{ label: "8", insert: "8" },
		{ label: "9", insert: "9" },
		{ label: "\u00d7", insert: "*", color: "op", aria: "Multiply" },
		{ label: "4", insert: "4" },
		{ label: "5", insert: "5" },
		{ label: "6", insert: "6" },
		{ label: "\u2212", insert: "-", color: "op", aria: "Subtract" },
		{ label: "1", insert: "1" },
		{ label: "2", insert: "2" },
		{ label: "3", insert: "3" },
		{ label: "+", insert: "+", color: "op", aria: "Add" },
		{
			label: "(-)",
			insert: "(-",
			color: "fn-alt",
			aria: "Negate",
			title: "Negate",
		},
		{ label: "0", insert: "0" },
		{ label: ".", insert: "." },
		{ label: "=", action: "equals", color: "eq", aria: "Equals" },
	];

	function handleKey(def: KeyDef) {
		if (def.action === "equals") return doEquals();
		if (def.action === "clear") return doClear();
		if (def.action === "del") return doBackspace();
		if (def.insert) return insert(def.insert);
	}

	const trigSpecs: TrigBase[] = ["sin", "cos", "tan"];

	const scienceRows: Array<{
		defs: Array<{
			label: React.ReactNode;
			onClick: () => void;
			color: KeyColor;
			title?: string;
		}>;
	}> = [];

	scienceRows.push({
		defs: trigSpecs.map((base) => {
			const t = trigFor(shift2nd, hyp, base);
			return {
				label: t.label,
				onClick: () => insert(t.ins),
				color: "fn",
				title: t.name,
			};
		}),
	});

	scienceRows.push({
		defs: [
			{
				label: shift2nd ? "10^x" : "log",
				onClick: () => insert(shift2nd ? "10^(" : "log("),
				color: "fn",
				title: shift2nd ? "10^x" : "log10",
			},
			{
				label: shift2nd ? "e^x" : "ln",
				onClick: () => insert(shift2nd ? "exp(" : "ln("),
				color: "fn",
				title: shift2nd ? "e^x" : "natural log",
			},
			{
				label: shift2nd ? "x\u00b3" : "x\u00b2",
				onClick: () => insert(shift2nd ? "^3" : "^2"),
				color: "fn-alt",
				title: shift2nd ? "cube" : "square",
			},
			{
				label: shift2nd ? "\u221b" : "\u221a",
				onClick: () => insert(shift2nd ? "cbrt(" : "sqrt("),
				color: "fn-alt",
				title: shift2nd ? "cube root" : "square root",
			},
			{
				label: "x^y",
				onClick: () => insert("^"),
				color: "fn-alt",
				title: "power",
			},
		],
	});

	scienceRows.push({
		defs: [
			{
				label: "1/x",
				onClick: () => insert("^(-1)"),
				color: "fn-alt",
				title: "Reciprocal",
			},
			{
				label: "x!",
				onClick: () => insert("!"),
				color: "fn-alt",
				title: "Factorial",
			},
			{
				label: "mod",
				onClick: () => insert("mod"),
				color: "fn",
				title: "Modulo",
			},
			{
				label: "log2",
				onClick: () => insert("log2("),
				color: "fn",
				title: "log base 2",
			},
			{
				label: "abs",
				onClick: () => insert("abs("),
				color: "fn",
				title: "Absolute",
			},
		],
	});

	scienceRows.push({
		defs: [
			{
				label: "\u03c0",
				onClick: () => insert("pi"),
				color: "fn-alt",
				title: "pi",
			},
			{
				label: "e",
				onClick: () => insert("e"),
				color: "fn-alt",
				title: "e constant",
			},
			{
				label: "Ans",
				onClick: () => insert("ans"),
				color: "fn",
				title: "Last answer",
			},
			{
				label: "rand",
				onClick: () => insert(String(Math.random())),
				color: "fn-alt",
				title: "Random 0-1",
			},
			{
				label: "(",
				onClick: () => insert("("),
				color: "fn",
				title: "Open paren",
			},
			{
				label: ")",
				onClick: () => insert(")"),
				color: "fn",
				title: "Close paren",
			},
		],
	});

	scienceRows.push({
		defs: [
			{
				label: "floor",
				onClick: () => insert("floor("),
				color: "fn",
				title: "Floor",
			},
			{
				label: "ceil",
				onClick: () => insert("ceil("),
				color: "fn",
				title: "Ceiling",
			},
			{
				label: "round",
				onClick: () => insert("round("),
				color: "fn",
				title: "Round",
			},
			{
				label: "sign",
				onClick: () => insert("sign("),
				color: "fn",
				title: "Sign",
			},
		],
	});

	const memKeys = [
		{
			label: "MC",
			onClick: mClear,
			color: "mem" as KeyColor,
			aria: "Memory clear",
		},
		{
			label: "MR",
			onClick: mRecall,
			color: "mem" as KeyColor,
			aria: "Memory recall",
		},
		{
			label: "M\u2212",
			onClick: mMinus,
			color: "mem" as KeyColor,
			aria: "Memory minus",
		},
		{
			label: "M+",
			onClick: mPlus,
			color: "mem" as KeyColor,
			aria: "Memory plus",
		},
	];

	return (
		<div className="calc-app" data-mode={mode}>
			<div className="calc-top">
				<header className="calc-head">
					<div className="brand">
						<span className="brand-dot" />
						<h1>Pretty Calc</h1>
					</div>
					<div className="head-toggles">
						<button
							type="button"
							className="mode-pill"
							onClick={() => setMode((m) => nextMode(m))}
							title="Cycle mode"
						>
							{MODE_LABEL[mode]}
						</button>
						<button
							type="button"
							className="mode-pill"
							onClick={() => setShowHistory((v) => !v)}
							aria-pressed={showHistory}
							aria-label="Toggle history"
							title="History"
						>
							hist
						</button>
						<button
							type="button"
							className="angle-pill"
							onClick={() =>
								setAngleMode((m) =>
									m === "DEG" ? "RAD" : "DEG",
								)
							}
							aria-label="Toggle angle mode"
						>
							{angleMode}
						</button>
					</div>
				</header>

				{mode === "basic" && (
					<button
						type="button"
						className={`sci-toggle ${showSci ? "is-on" : ""}`}
						onClick={() => setShowSci((v) => !v)}
						aria-pressed={showSci}
						aria-label="Toggle scientific functions"
						title="Scientific functions"
					>
						<span className="sci-toggle-knob" />
						<span className="sci-toggle-text">Scientific</span>
					</button>
				)}

				{mode === "basic" && (
					<section className="display" aria-live="polite">
						<div className="display-meta">
							<span className="meta-tag">{angleMode}</span>
							{mem !== 0 && (
								<span className="meta-tag meta-mem">M</span>
							)}
							{showSci && shift2nd && (
								<span className="meta-tag meta-shift">2nd</span>
							)}
							{showSci && hyp && (
								<span className="meta-tag meta-shift">HYP</span>
							)}
						</div>
						<div
							className="display-expr"
							role="status"
							aria-label="Expression"
						>
							{expr || "\u00a0"}
						</div>
						<div
							className={`display-result ${
								display.kind === "err" ? "is-err" : ""
							}`}
						>
							{display.text}
						</div>
						<div className="display-preview-hint">
							{display.kind === "ok" && expr.trim()
								? "preview"
								: "\u00a0"}
						</div>
					</section>
				)}
			</div>

			{mode === "basic" && showSci && (
				<section
					className="sci-panel"
					aria-label="Scientific functions"
				>
					<div className="sci-top">
						<Key
							label="2nd"
							onClick={() => setShift2nd((v) => !v)}
							color="toggle"
							active={shift2nd}
							ariaLabel="Toggle second functions"
						/>
						<Key
							label="HYP"
							onClick={() => setHyp((v) => !v)}
							color="toggle"
							active={hyp}
							ariaLabel="Toggle hyperbolic"
						/>
					</div>
					<div className="sci-grid">
						{scienceRows.flatMap((row) =>
							row.defs.map((d) => (
								<Key
									key={String(d.label)}
									label={d.label}
									onClick={d.onClick}
									color={d.color}
									title={d.title}
								/>
							)),
						)}
					</div>
					<div className="mem-strip">
						{memKeys.map((m) => (
							<Key
								key={String(m.label)}
								label={m.label}
								onClick={m.onClick}
								color={m.color}
								ariaLabel={m.aria}
							/>
						))}
					</div>
					<div className="mem-state">Memory: {formatResult(mem)}</div>
				</section>
			)}

			{mode === "base-n" && <BaseNPanel />}

			{mode === "convert" && <ConverterPanel />}

			{mode === "graph" && <GraphPanel angleMode={angleMode} />}

			{showHistory && (
				<section className="history" aria-label="History">
					<div className="history-head">
						<span>History</span>
						<button
							type="button"
							className="ghost"
							onClick={clearHistory}
						>
							clear
						</button>
					</div>
					{history.length === 0 ? (
						<p className="history-empty">No calculations yet.</p>
					) : (
						<ul className="history-list">
							{history.map((h) => (
								<li key={h.id}>
									<div className="hist-expr">{h.expr}</div>
									<div className="hist-equals">=</div>
									<div className="hist-result">
										{h.result}
									</div>
									<div className="hist-actions">
										<button
											type="button"
											className="ghost"
											onClick={() => reuse(h, "result")}
											aria-label="Insert result"
										>
											use
										</button>
										<button
											type="button"
											className="ghost"
											onClick={() => reuse(h, "expr")}
											aria-label="Insert expression"
										>
											expr
										</button>
									</div>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{mode === "basic" && (
				<section className="keypad" aria-label="Numeric keypad">
					{digitKeys.map((d) => (
						<Key
							key={String(d.label)}
							label={d.label}
							onClick={() => handleKey(d)}
							color={d.color}
							ariaLabel={d.aria}
							title={d.title}
						/>
					))}
				</section>
			)}

			<footer className="calc-foot">
				<span>{TAURI_AVAILABLE ? "rust engine" : "ts engine"}</span>
				<span>keyboard + touch ready</span>
			</footer>
		</div>
	);
}
