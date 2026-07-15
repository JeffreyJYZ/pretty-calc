import type * as React from "react";

export type KeyColor =
	| "digit"
	| "op"
	| "fn"
	| "fn-alt"
	| "eq"
	| "clr"
	| "toggle"
	| "mem";

export type KeyProps = {
	label: React.ReactNode;
	onClick: () => void;
	color?: KeyColor;
	className?: string;
	area?: string /* grid-area */;
	disabled?: boolean;
	ariaLabel?: string;
	active?: boolean;
	title?: string;
};

const colorClass: Record<KeyColor, string> = {
	digit: "key-digit",
	op: "key-op",
	fn: "key-fn",
	"fn-alt": "key-fn-alt",
	eq: "key-eq",
	clr: "key-clr",
	toggle: "key-toggle",
	mem: "key-mem",
};

export function Key({
	label,
	onClick,
	color = "digit",
	className,
	area,
	disabled,
	ariaLabel,
	active,
	title,
}: KeyProps) {
	return (
		<button
			type="button"
			className={`key ${colorClass[color]} ${active ? "key-active" : ""} ${
				className ?? ""
			}`.trim()}
			style={area ? { gridArea: area } : undefined}
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
			aria-pressed={active}
			title={title}
		>
			{label}
		</button>
	);
}
