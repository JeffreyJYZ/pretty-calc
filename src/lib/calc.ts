// Pretty Calc — math expression engine.
// Tokenizer -> shunting-yard (RPN) -> evaluator. No eval(). Safe + predictable.

export type AngleMode = "DEG" | "RAD";

type Token =
	| { type: "num"; value: number }
	| { type: "op"; value: OpName }
	| { type: "func"; value: string }
	| { type: "paren"; value: "(" | ")" }
	| { type: "postfix"; value: "!" | "%" }
	| { type: "comma" };

type OpName =
	| "+"
	| "-"
	| "*"
	| "/"
	| "^"
	| "mod"
	| "neg" // unary minus
	| "mul"; // implicit multiplication

const FUNCTIONS = new Set([
	"sin",
	"cos",
	"tan",
	"asin",
	"acos",
	"atan",
	"sinh",
	"cosh",
	"tanh",
	"asinh",
	"acosh",
	"atanh",
	"ln",
	"log",
	"log2",
	"sqrt",
	"cbrt",
	"exp",
	"abs",
	"floor",
	"ceil",
	"round",
	"sign",
]);

const PRECEDENCE: Record<OpName, number> = {
	"^": 5,
	neg: 5,
	mul: 3,
	"*": 3,
	"/": 3,
	mod: 3,
	"+": 2,
	"-": 2,
};

const RIGHT_ASSOC = new Set<OpName>(["^", "neg"]);

const OP_ARITY: Record<OpName, number> = {
	"^": 2,
	"*": 2,
	"/": 2,
	mod: 2,
	"+": 2,
	"-": 2,
	neg: 1,
	mul: 2,
};

/** Build the set of function names so the UI can know what exists. */
export const FUNC_NAMES = [...FUNCTIONS];

function isValueEnd(t: Token | undefined): boolean {
	if (!t) return false;
	if (t.type === "num") return true;
	if (t.type === "paren" && t.value === ")") return true;
	if (t.type === "postfix") return true;
	return false;
}

function isValueStart(t: Token): boolean {
	return (
		t.type === "num" ||
		t.type === "func" ||
		(t.type === "paren" && t.value === "(")
	);
}

/** Parse a math expression string into tokens, resolving constants. */
function tokenize(input: string, constants: Record<string, number>): Token[] {
	const s = input.replace(/\s+/g, "");
	const tokens: Token[] = [];
	const pushImplicitMulIfNeeded = (next: Token) => {
		if (isValueStart(next) && isValueEnd(tokens[tokens.length - 1])) {
			tokens.push({ type: "op", value: "mul" });
		}
	};

	let i = 0;
	while (i < s.length) {
		const c = s[i];

		// Number literal: digits + dot.
		if ((c >= "0" && c <= "9") || c === ".") {
			let j = i + 1;
			let dot = c === ".";
			while (j < s.length) {
				const d = s[j];
				if (d >= "0" && d <= "9") {
					j++;
				} else if (d === "." && !dot) {
					dot = true;
					j++;
				} else {
					break;
				}
			}
			const num = Number.parseFloat(s.slice(i, j));
			if (Number.isNaN(num)) throw new CalcError("Malformed number");
			const next: Token = { type: "num", value: num };
			pushImplicitMulIfNeeded(next);
			tokens.push(next);
			i = j;
			continue;
		}

		// Identifier: function name or constant.
		if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
			let j = i + 1;
			while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
			const name = s.slice(i, j).toLowerCase();
			let next: Token;
			if (name === "pi" || name === "e" || name === "ans") {
				if (!(name in constants)) {
					throw new CalcError(`Unknown constant: ${name}`);
				}
				next = { type: "num", value: constants[name] };
			} else if (name === "mod") {
				next = { type: "op", value: "mod" as OpName };
			} else if (name === "ln") {
				next = { type: "func", value: "ln" };
			} else if (FUNCTIONS.has(name)) {
				next = { type: "func", value: name };
			} else {
				throw new CalcError(`Unknown name: ${name}`);
			}
			pushImplicitMulIfNeeded(next);
			tokens.push(next);
			i = j;
			continue;
		}

		// Parentheses.
		if (c === "(" || c === ")") {
			const next: Token = { type: "paren", value: c };
			if (c === "(") pushImplicitMulIfNeeded(next);
			tokens.push(next);
			i++;
			continue;
		}

		if (c === ",") {
			tokens.push({ type: "comma" });
			i++;
			continue;
		}

		if (c === "!") {
			tokens.push({ type: "postfix", value: "!" });
			i++;
			continue;
		}

		if (c === "%") {
			tokens.push({ type: "postfix", value: "%" });
			i++;
			continue;
		}

		if (c === "+" || c === "-") {
			const prev = tokens[tokens.length - 1];
			const isUnary =
				!prev ||
				prev.type === "op" ||
				prev.type === "func" ||
				prev.type === "comma" ||
				(prev.type === "paren" && prev.value === "(");
			if (isUnary) {
				if (c === "-") tokens.push({ type: "op", value: "neg" });
				// unary plus is a no-op.
			} else {
				tokens.push({ type: "op", value: c });
			}
			i++;
			continue;
		}

		if (c === "*" || c === "×" || c === "·" || c === "\u2217") {
			tokens.push({ type: "op", value: "*" });
			i++;
			continue;
		}
		if (c === "/" || c === "\u00f7") {
			tokens.push({ type: "op", value: "/" });
			i++;
			continue;
		}
		if (c === "^" || c === "\u2211" /* not real exponent */) {
			tokens.push({ type: "op", value: "^" });
			i++;
			continue;
		}

		throw new CalcError(`Unexpected character: ${c}`);
	}

	return tokens;
}

/** Shunting-yard: infix token list -> RPN. */
function toRPN(tokens: Token[]): Token[] {
	const output: Token[] = [];
	const stack: Token[] = [];

	for (const t of tokens) {
		if (t.type === "num") {
			output.push(t);
		} else if (t.type === "func") {
			stack.push(t);
		} else if (t.type === "comma") {
			while (
				stack.length &&
				!(stack[stack.length - 1].type === "paren")
			) {
				output.push(stack.pop() as Token);
			}
			if (!stack.length) throw new CalcError("Misplaced comma");
		} else if (t.type === "op") {
			while (stack.length) {
				const top = stack[stack.length - 1];
				if (top.type === "func") {
					output.push(stack.pop() as Token);
					continue;
				}
				if (top.type === "op") {
					const topPrec = PRECEDENCE[top.value as OpName];
					const curPrec = PRECEDENCE[t.value];
					const rightAssoc = RIGHT_ASSOC.has(t.value);
					if (
						(rightAssoc && topPrec > curPrec) ||
						(!rightAssoc && topPrec >= curPrec)
					) {
						output.push(stack.pop() as Token);
						continue;
					}
				}
				break;
			}
			stack.push(t);
		} else if (t.type === "paren" && t.value === "(") {
			stack.push(t);
		} else if (t.type === "paren" && t.value === ")") {
			while (
				stack.length &&
				!(stack[stack.length - 1].type === "paren")
			) {
				output.push(stack.pop() as Token);
			}
			if (!stack.length) throw new CalcError("Mismatched parentheses");
			stack.pop(); // remove "("
			// Bring function to output.
			if (stack.length && stack[stack.length - 1].type === "func") {
				output.push(stack.pop() as Token);
			}
		} else if (t.type === "postfix") {
			output.push(t);
		}
	}

	while (stack.length) {
		const t = stack.pop() as Token;
		if (t.type === "paren") throw new CalcError("Mismatched parentheses");
		output.push(t);
	}

	return output;
}

function factorial(n: number): number {
	if (n < 0 || Math.floor(n) !== n) {
		throw new CalcError("Factorial requires non-negative integer");
	}
	if (n > 170) throw new CalcError("Factorial too large");
	let r = 1;
	for (let k = 2; k <= n; k++) r *= k;
	return r;
}

function applyFunc(name: string, x: number, angle: AngleMode): number {
	const toRad = (deg: number) =>
		angle === "DEG" ? (deg * Math.PI) / 180 : deg;
	const fromRad = (rad: number) =>
		angle === "DEG" ? (rad * 180) / Math.PI : rad;
	switch (name) {
		case "sin":
			return Math.sin(toRad(x));
		case "cos":
			return Math.cos(toRad(x));
		case "tan":
			return Math.tan(toRad(x));
		case "asin":
			return fromRad(Math.asin(x));
		case "acos":
			return fromRad(Math.acos(x));
		case "atan":
			return fromRad(Math.atan(x));
		case "sinh":
			return Math.sinh(x);
		case "cosh":
			return Math.cosh(x);
		case "tanh":
			return Math.tanh(x);
		case "asinh":
			return Math.asinh(x);
		case "acosh":
			return Math.acosh(x);
		case "atanh":
			return Math.atanh(x);
		case "ln":
			return Math.log(x);
		case "log":
			return Math.log10(x);
		case "log2":
			return Math.log2(x);
		case "sqrt":
			return Math.sqrt(x);
		case "cbrt":
			return Math.cbrt(x);
		case "exp":
			return Math.exp(x);
		case "abs":
			return Math.abs(x);
		case "floor":
			return Math.floor(x);
		case "ceil":
			return Math.ceil(x);
		case "round":
			return Math.round(x);
		case "sign":
			return Math.sign(x);
		default:
			throw new CalcError(`Unknown function: ${name}`);
	}
}

/** Evaluate an RPN token stream. */
function evaluateRPN(rpn: Token[], angle: AngleMode): number {
	const stack: number[] = [];
	for (const t of rpn) {
		if (t.type === "num") {
			stack.push(t.value);
		} else if (t.type === "postfix") {
			if (!stack.length) throw new CalcError("Syntax error");
			const a = stack.pop() as number;
			stack.push(t.value === "!" ? factorial(a) : a / 100);
		} else if (t.type === "op") {
			const arity = OP_ARITY[t.value];
			if (arity === 1) {
				if (!stack.length) throw new CalcError("Syntax error");
				const a = stack.pop() as number;
				if (t.value === "neg") stack.push(-a);
			} else if (arity === 2) {
				if (stack.length < 2) throw new CalcError("Syntax error");
				const b = stack.pop() as number;
				const a = stack.pop() as number;
				switch (t.value) {
					case "+":
						stack.push(a + b);
						break;
					case "-":
						stack.push(a - b);
						break;
					case "*":
					case "mul":
						stack.push(a * b);
						break;
					case "/":
						if (b === 0) throw new CalcError("Division by zero");
						stack.push(a / b);
						break;
					case "^":
						stack.push(a ** b);
						break;
					case "mod":
						if (b === 0) throw new CalcError("Mod by zero");
						stack.push(((a % b) + b) % b);
						break;
				}
			}
		} else if (t.type === "func") {
			if (!stack.length)
				throw new CalcError(`Missing argument for ${t.value}`);
			const a = stack.pop() as number;
			stack.push(applyFunc(t.value, a, angle));
		} else {
			throw new CalcError("Malformed expression");
		}
	}
	if (stack.length !== 1) {
		throw new CalcError(
			stack.length === 0 ? "Empty input" : "Syntax error",
		);
	}
	return stack[0] as number;
}

export class CalcError extends Error {
	constructor(msg: string) {
		super(msg);
		this.name = "CalcError";
	}
}

export type EvalOptions = {
	angleMode?: AngleMode;
	ans?: number;
};

/** Evaluate a math expression string to a number. Throws CalcError on bad input. */
export function evaluate(input: string, opts: EvalOptions = {}): number {
	const angle: AngleMode = opts.angleMode ?? "DEG";
	const ans = opts.ans ?? 0;
	const trimmed = input.trim();
	if (!trimmed) throw new CalcError("Empty input");
	const tokens = tokenize(trimmed, { pi: Math.PI, e: Math.E, ans });
	const rpn = toRPN(tokens);
	// quick check: ensure there's at least one value-producing token
	const valueless =
		tokens.length === 0 ||
		tokens.every(
			(t) =>
				t.type === "op" ||
				t.type === "comma" ||
				(t.type === "paren" && t.value === "("),
		);
	if (valueless) throw new CalcError("Syntax error");
	return evaluateRPN(rpn, angle);
}

/** Try to evaluate; return null on any error (used for live preview). */
export function tryEvaluate(input: string, opts: EvalOptions): number | null {
	try {
		const r = evaluate(input, opts);
		if (!Number.isFinite(r)) return null;
		return r;
	} catch {
		return null;
	}
}

/** Format a number for display: compact, rounds float fuzz, uses scientific for extremes. */
export function formatResult(value: number): string {
	if (!Number.isFinite(value)) return "Error";
	if (Number.isNaN(value)) return "Error";
	if (value === 0) return "0";
	const abs = Math.abs(value);
	if (abs >= 1e15 || abs < 1e-9) {
		return value.toExponential(8).replace(/\.?0+e/, "e");
	}
	// Round to 12 significant digits to kill float fuzz, then trim.
	const r = Number.parseFloat(value.toPrecision(12));
	let s = String(r);
	if (s.includes(".") && !s.includes("e")) {
		s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
	}
	return s;
}
