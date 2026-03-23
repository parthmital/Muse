/**
 * utils/colorTheme.ts
 *
 * Empty for now as global theme was removed.
 */

export const dynamicColorSettings = {
	STORAGE_KEY: "dynamic-color-enabled",
	isEnabled() {
		try {
			return localStorage.getItem(this.STORAGE_KEY) !== "false";
		} catch {
			return true;
		}
	},
	setEnabled(enabled: boolean) {
		localStorage.setItem(this.STORAGE_KEY, enabled ? "true" : "false");
	},
};
