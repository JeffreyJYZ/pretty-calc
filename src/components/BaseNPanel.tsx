import * as React from "react";
import { Key } from "./Key";

export type Base = "DEC" | "HEX" | "OCT" | "BIN";

const LABELS: Record<Base, string> = {
	DEC: "DEC",
	HEX: "HEX",
	OCT: "OCT",
	BIN: "BIN",
};

const RADIX: Record<Base, number> = {
	DEC: 10,
	HEX: 16,
	OCT: 8,
	BIN: 2,
};

const VALID_CHARS: Record<Base, string> = {
	DEC: "0-9",
	HEX: "0-9a-fA-F",
	OCT: "0-7",
	BIN: "01",
};

function parse(value: string, base: Base): number | null {
	const clean = value.trim().toLowerCase();
	if (!clean) return 0;
	const radix = RADIX[base];
	const n = Number.parseInt(clean, radix);
	if (Number.isNaN(n)) return null;
	return n;
}

function format(n: number, base: Base): string {
	if (!Number.isFinite(n)) return "Error";
	if (base === "DEC") return formatNumber(n);
	const abs = Math.abs(n);
	const digits = abs.toString(RADIX[base]);
	const sign = n < 0 ? "-" : "";
	if (base === "BIN") {
		// Group in 4-bit nibbles for readability.
		const grouped = digits.replace(/(?!^)(?=(?:\d{4})+$)/g, " ");
		return `${sign}${grouped}`;
	}
	return `${sign}${digits.toUpperCase()}`;
}

function formatNumber(n: number): string {
	if (!Number.isFinite(n)) return "Error";
	const s = n.toPrecision(12).replace(/\.?0+$/, "");
	return s;
}

const HEX_DIGITS = ["A", "B", "C", "D", "E", "F"];

export function BaseNPanel() {
	const [base, setBase] = React.useState<Base>("HEX");
	const [input, setInput] = React.useState<string>("0");
	const [error, setError] = React.useState<string | null>(null);

	const value = React.useMemo<number | null>(() => {
		if (error) return null;
		return parse(input, base);
	}, [input, base, error]);

	function press(ch: string) {
		setError(null);
		setInput((prev) => {
			if (prev === "0") return ch;
			return prev + ch;
		});
	}

	function clearAll() {
		setInput("0");
		setError(null);
	}

	function backspace() {
		setInput((prev) => (prev.length <= 1 ? "0" : prev.slice(0, -1)));
	}

	function switchBase(newBase: Base) {
		// Convert current input value to the new base.
		const v = parse(input, base);
		if (v === null) {
			setError("Bad input for current base");
			return;
		}
		setBase(newBase);
		setInput(format(v, newBase));
		setError(null);
	}

	// Operations: only meaningful when input is integer in current base.
	function applyOp(op: "not" | "shl" | "shr" | "and" | "or" | "xor") {
		const v = parse(input, base);
		if (v === null) {
			setError("Bad input");
			return;
		}
		let result: number;
		switch (op) {
			case "not":
				result = ~v;
				break;
			case "shl":
				result = v << 1;
				break;
			case "shr":
				result = v >> 1;
				break;
			default:
				return;
		}
		// and/or/xor need a right operand; route to helper instead.
		setInput(format(result, base));
	}

	// Hex letters on top (2 rows of 3), then standard calculator layout
	// for numbers (7 8 9 / 4 5 6 / 1 2 3), 0 centered at bottom.
	// For bases with fewer digits, leftover digits are centered on their row.
	// OCT: 7 stays left (normal), 0 fills the top-right so the row looks balanced.
	const digitRows: (string | null)[][] = [];

	if (base === "HEX") {
		digitRows.push(["A", "B", "C"]);
		digitRows.push(["D", "E", "F"]);
	}

	const maxDigit = RADIX[base] - 1;
	const numRows = [
		["7", "8", "9"],
		["4", "5", "6"],
		["1", "2", "3"],
	];
	const zeroPlaced = false;
	for (const row of numRows) {
		const valid = row.filter((d) => Number.parseInt(d, 10) <= maxDigit);
		if (valid.length === 0) continue;
		if (valid.length === 1) {
			if (base === "OCT") {
				digitRows.push([valid[0], null, null]);
			} else {
				digitRows.push([valid[0]]);
			}
		} else if (valid.length === 2) {
			digitRows.push([valid[0], valid[1], null]);
		} else {
			digitRows.push(valid as (string | null)[]);
		}
	}

	if (!zeroPlaced) {
		digitRows.push(["0"]);
	}

	return (
		<section className="sci-panel" aria-label="Base-N mode">
			<div className="sci-top">
				{(["HEX", "DEC", "OCT", "BIN"] as Base[]).map((b) => (
					<Key
						key={b}
						label={LABELS[b]}
						onClick={() => switchBase(b)}
						color="toggle"
						active={base === b}
						ariaLabel={`Switch to ${b}`}
					/>
				))}
				<Key
					label="AC"
					onClick={clearAll}
					color="clr"
					ariaLabel="All clear"
				/>
			</div>

			<div className="display-compact">
				<div className="display-meta">
					<span className="meta-tag">{base}</span>
				</div>
				<div className="display-expr" role="status" aria-label="Input">
					{input || "\u00a0"}
				</div>
				<div className="display-result">
					{error ? (
						<span className="is-err">{error}</span>
					) : (
						format(value ?? 0, base)
					)}
				</div>
				<div className="display-meta mono-row">
					<span>
						HEX:{" "}
						{(parse(input, base) ?? 0).toString(16).toUpperCase()}
					</span>
					<span>DEC: {parse(input, base) ?? 0}</span>
				</div>
				<div className="display-meta mono-row">
					<span>OCT: {(parse(input, base) ?? 0).toString(8)}</span>
					<span>
						BIN:{" "}
						{(parse(input, base) ?? 0)
							.toString(2)
							.replace(/(?!^)(?=(?:\d{4})+$)/g, " ")}
					</span>
				</div>
			</div>

			<div className="op-strip">
				<Key
					label="NOT"
					onClick={() => applyOp("not")}
					color="fn"
					title="Bitwise NOT"
				/>
				<Key
					label="<<"
					onClick={() => applyOp("shl")}
					color="fn"
					title="Shift left"
				/>
				<Key
					label=">>"
					onClick={() => applyOp("shr")}
					color="fn"
					title="Shift right"
				/>
				<Key
					label="DEL"
					onClick={backspace}
					color="clr"
					ariaLabel="Delete"
				/>
			</div>

			<div className="sci-grid base-n-grid">
				{digitRows.flatMap((row, ri) => {
					if (row.length === 1 && row[0] !== null) {
						const d = row[0];
						const ch = d.toLowerCase();
						return (
							<div key={`zero-${d}`} className="base-n-zero-row">
								<Key
									label={d}
									onClick={() => press(ch)}
									color="digit"
								/>
							</div>
						);
					}
					let spacerCount = 0;
					return row.map((d) => {
						if (d === null) {
							const id = `spacer-${ri}-${spacerCount}`;
							spacerCount++;
							return (
								<div
									key={id}
									className="key-spacer"
									aria-hidden="true"
								/>
							);
						}
						const ch = d.toLowerCase();
						const isHexLetter = HEX_DIGITS.includes(d);
						return (
							<Key
								key={d}
								label={d}
								onClick={() => press(ch)}
								color={isHexLetter ? "fn-alt" : "digit"}
							/>
						);
					});
				})}
			</div>
		</section>
	);
}

void VALID_CHARS; // exported for completeness if needed elsewhere
