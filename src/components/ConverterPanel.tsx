import * as React from "react";

type Category =
	| "length"
	| "mass"
	| "temp"
	| "time"
	| "data"
	| "speed"
	| "angle";

type Unit = {
	id: string;
	label: string;
	// toBase: convert a value in this unit to base unit
	toBase: (v: number) => number;
	// fromBase: convert a base-unit value to this unit
	fromBase: (v: number) => number;
};

const UNITS: Record<Category, Unit[]> = {
	length: [
		{
			id: "mm",
			label: "millimeter",
			toBase: (v) => v / 1000,
			fromBase: (v) => v * 1000,
		},
		{
			id: "cm",
			label: "centimeter",
			toBase: (v) => v / 100,
			fromBase: (v) => v * 100,
		},
		{ id: "m", label: "meter", toBase: (v) => v, fromBase: (v) => v },
		{
			id: "km",
			label: "kilometer",
			toBase: (v) => v * 1000,
			fromBase: (v) => v / 1000,
		},
		{
			id: "in",
			label: "inch",
			toBase: (v) => v * 0.0254,
			fromBase: (v) => v / 0.0254,
		},
		{
			id: "ft",
			label: "foot",
			toBase: (v) => v * 0.3048,
			fromBase: (v) => v / 0.3048,
		},
		{
			id: "yd",
			label: "yard",
			toBase: (v) => v * 0.9144,
			fromBase: (v) => v / 0.9144,
		},
		{
			id: "mi",
			label: "mile",
			toBase: (v) => v * 1609.344,
			fromBase: (v) => v / 1609.344,
		},
		{
			id: "nmi",
			label: "nautical mile",
			toBase: (v) => v * 1852,
			fromBase: (v) => v / 1852,
		},
	],
	mass: [
		{
			id: "mg",
			label: "milligram",
			toBase: (v) => v / 1_000_000,
			fromBase: (v) => v * 1_000_000,
		},
		{
			id: "g",
			label: "gram",
			toBase: (v) => v / 1000,
			fromBase: (v) => v * 1000,
		},
		{ id: "kg", label: "kilogram", toBase: (v) => v, fromBase: (v) => v },
		{
			id: "t",
			label: "metric ton",
			toBase: (v) => v * 1000,
			fromBase: (v) => v / 1000,
		},
		{
			id: "oz",
			label: "ounce",
			toBase: (v) => v * 0.028349523125,
			fromBase: (v) => v / 0.028349523125,
		},
		{
			id: "lb",
			label: "pound",
			toBase: (v) => v * 0.45359237,
			fromBase: (v) => v / 0.45359237,
		},
		{
			id: "stone",
			label: "stone",
			toBase: (v) => v * 6.35029318,
			fromBase: (v) => v / 6.35029318,
		},
	],
	temp: [
		{
			id: "C",
			label: "Celsius",
			toBase: (v) => v,
			fromBase: (v) => v,
		},
		{
			id: "F",
			label: "Fahrenheit",
			toBase: (v) => ((v - 32) * 5) / 9,
			fromBase: (v) => (v * 9) / 5 + 32,
		},
		{
			id: "K",
			label: "Kelvin",
			toBase: (v) => v - 273.15,
			fromBase: (v) => v + 273.15,
		},
		{
			id: "R",
			label: "Rankine",
			toBase: (v) => (v - 491.67) * (5 / 9),
			fromBase: (v) => v * (9 / 5) + 491.67,
		},
	],
	time: [
		{
			id: "ns",
			label: "nanosecond",
			toBase: (v) => v / 1e9,
			fromBase: (v) => v * 1e9,
		},
		{
			id: "us",
			label: "microsecond",
			toBase: (v) => v / 1e6,
			fromBase: (v) => v * 1e6,
		},
		{
			id: "ms",
			label: "millisecond",
			toBase: (v) => v / 1000,
			fromBase: (v) => v * 1000,
		},
		{ id: "s", label: "second", toBase: (v) => v, fromBase: (v) => v },
		{
			id: "min",
			label: "minute",
			toBase: (v) => v * 60,
			fromBase: (v) => v / 60,
		},
		{
			id: "h",
			label: "hour",
			toBase: (v) => v * 3600,
			fromBase: (v) => v / 3600,
		},
		{
			id: "day",
			label: "day",
			toBase: (v) => v * 86_400,
			fromBase: (v) => v / 86_400,
		},
		{
			id: "wk",
			label: "week",
			toBase: (v) => v * 604_800,
			fromBase: (v) => v / 604_800,
		},
		{
			id: "yr",
			label: "year",
			toBase: (v) => v * 31_557_600,
			fromBase: (v) => v / 31_557_600,
		},
	],
	data: [
		{ id: "b", label: "bit", toBase: (v) => v / 8, fromBase: (v) => v * 8 },
		{ id: "B", label: "byte", toBase: (v) => v, fromBase: (v) => v },
		{
			id: "KB",
			label: "kilobyte",
			toBase: (v) => v * 1024,
			fromBase: (v) => v / 1024,
		},
		{
			id: "MB",
			label: "megabyte",
			toBase: (v) => v * 1024 ** 2,
			fromBase: (v) => v / 1024 ** 2,
		},
		{
			id: "GB",
			label: "gigabyte",
			toBase: (v) => v * 1024 ** 3,
			fromBase: (v) => v / 1024 ** 3,
		},
		{
			id: "TB",
			label: "terabyte",
			toBase: (v) => v * 1024 ** 4,
			fromBase: (v) => v / 1024 ** 4,
		},
		{
			id: "PB",
			label: "petabyte",
			toBase: (v) => v * 1024 ** 5,
			fromBase: (v) => v / 1024 ** 5,
		},
	],
	speed: [
		{ id: "mps", label: "m/s", toBase: (v) => v, fromBase: (v) => v },
		{
			id: "kmh",
			label: "km/h",
			toBase: (v) => v / 3.6,
			fromBase: (v) => v * 3.6,
		},
		{
			id: "mph",
			label: "mph",
			toBase: (v) => v * 0.44704,
			fromBase: (v) => v / 0.44704,
		},
		{
			id: "kn",
			label: "knot",
			toBase: (v) => v * 0.514444,
			fromBase: (v) => v / 0.514444,
		},
		{
			id: "fts",
			label: "ft/s",
			toBase: (v) => v * 0.3048,
			fromBase: (v) => v / 0.3048,
		},
		{
			id: "M",
			label: "Mach (at sea level)",
			toBase: (v) => v * 340.29,
			fromBase: (v) => v / 340.29,
		},
		{
			id: "c",
			label: "speed of light",
			toBase: (v) => v * 299_792_458,
			fromBase: (v) => v / 299_792_458,
		},
	],
	angle: [
		{ id: "deg", label: "degree", toBase: (v) => v, fromBase: (v) => v },
		{
			id: "rad",
			label: "radian",
			toBase: (v) => (v * 180) / Math.PI,
			fromBase: (v) => (v * Math.PI) / 180,
		},
		{
			id: "grad",
			label: "gradian",
			toBase: (v) => v * 0.9,
			fromBase: (v) => v / 0.9,
		},
		{
			id: "turn",
			label: "turn",
			toBase: (v) => v * 360,
			fromBase: (v) => v / 360,
		},
		{
			id: "arcmin",
			label: "arcminute",
			toBase: (v) => v / 60,
			fromBase: (v) => v * 60,
		},
		{
			id: "arcsec",
			label: "arcsecond",
			toBase: (v) => v / 3600,
			fromBase: (v) => v * 3600,
		},
	],
};

const CATEGORY_LABEL: Record<Category, string> = {
	length: "Length",
	mass: "Mass",
	temp: "Temperature",
	time: "Time",
	data: "Data",
	speed: "Speed",
	angle: "Angle",
};

function format(value: number): string {
	if (!Number.isFinite(value)) return "Error";
	const abs = Math.abs(value);
	if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) {
		return value.toExponential(6).replace(/\.?0+e/, "e");
	}
	const r = Number.parseFloat(value.toPrecision(10));
	let s = String(r);
	if (s.includes(".") && !s.includes("e")) {
		s = s.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
	}
	return s;
}

export function ConverterPanel() {
	const [category, setCategory] = React.useState<Category>("length");
	const [from, setFrom] = React.useState<string>("m");
	const [to, setTo] = React.useState<string>("ft");
	const [value, setValue] = React.useState<string>("1");

	const units = UNITS[category];

	// Reset to first two units when category changes.
	React.useEffect(() => {
		setFrom(units[0].id);
		setTo(units[1].id);
	}, [units]);

	const fromUnit = units.find((u) => u.id === from) ?? units[0];
	const toUnit = units.find((u) => u.id === to) ?? units[1];

	const input = Number.parseFloat(value);
	const result = React.useMemo<number | null>(() => {
		if (Number.isNaN(input)) return null;
		const base = fromUnit.toBase(input);
		return toUnit.fromBase(base);
	}, [input, fromUnit, toUnit]);

	const ratio = React.useMemo<number | null>(() => {
		const base = fromUnit.toBase(1);
		return toUnit.fromBase(base);
	}, [fromUnit, toUnit]);

	function swap() {
		setFrom(to);
		setTo(from);
	}

	return (
		<section className="sci-panel converter" aria-label="Unit converter">
			<div className="converter-categories">
				{(Object.keys(UNITS) as Category[]).map((c) => (
					<button
						key={c}
						type="button"
						className={`conv-cat ${c === category ? "cat-active" : ""}`}
						onClick={() => setCategory(c)}
					>
						{CATEGORY_LABEL[c]}
					</button>
				))}
			</div>

			<div className="converter-row">
				<div className="converter-side">
					<input
						type="number"
						step="any"
						value={value}
						onChange={(e) => setValue(e.currentTarget.value)}
						className="converter-input"
						aria-label="Value to convert"
					/>
					<select
						value={from}
						onChange={(e) => setFrom(e.currentTarget.value)}
						className="converter-select"
						aria-label="From unit"
					>
						{units.map((u) => (
							<option key={u.id} value={u.id}>
								{u.label}
							</option>
						))}
					</select>
				</div>

				<button
					type="button"
					className="converter-swap"
					onClick={swap}
					aria-label="Swap units"
					title="Swap"
				>
					\&harr;
				</button>

				<div className="converter-side">
					<div
						className={`converter-output ${result !== null && format(result).length > 8 ? "is-long" : ""}`}
						role="status"
						aria-label="Converted value"
					>
						{result === null ? "Error" : format(result)}
					</div>
					<select
						value={to}
						onChange={(e) => setTo(e.currentTarget.value)}
						className="converter-select"
						aria-label="To unit"
					>
						{units.map((u) => (
							<option key={u.id} value={u.id}>
								{u.label}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="converter-expr">
				1 {fromUnit.label} = {ratio === null ? "Error" : format(ratio)}{" "}
				{toUnit.label}
			</div>
		</section>
	);
}
