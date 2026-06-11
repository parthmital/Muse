import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			"dist/**",
			"node_modules/**",
			"prisma/**",
			"*.config.*",
			"src/types/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.node },
		},
		rules: {
			// The codebase intentionally uses `any` at the raw-SQL/$queryRaw boundary.
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			// Best-effort `try { … } catch {}` around non-critical work is a
			// deliberate pattern in services (cache writes, persistence).
			"no-empty": ["error", { allowEmptyCatch: true }],
		},
	},
);
