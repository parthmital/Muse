"use client";

interface SettingsToggleProps {
	enabled: boolean;
	onChange: (enabled: boolean) => void;
	disabled?: boolean;
}

export function SettingsToggle({
	enabled,
	onChange,
	disabled = false,
}: SettingsToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={enabled}
			disabled={disabled}
			onClick={() => onChange(!enabled)}
			className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
				enabled ? "bg-white" : "bg-neutral-800"
			} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
		>
			<span
				aria-hidden="true"
				className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
					enabled ? "translate-x-5" : "translate-x-0"
				}`}
			/>
		</button>
	);
}
