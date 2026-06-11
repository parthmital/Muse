/**
 * Ambient module declaration for dash.js.
 *
 * The dashjs package resolves to its bundled `dash.all.min.js` with no type
 * declarations, which trips `noImplicitAny` under strict mode. This typed shim
 * covers the MediaPlayer surface PlayerContext actually uses; the index
 * signature keeps it forgiving for the rest of the (large) API.
 */
declare module "dashjs" {
	export interface MediaPlayerClass {
		initialize(
			view?: HTMLElement | null,
			source?: string | null,
			autoStart?: boolean,
		): void;
		attachView(view: HTMLElement): void;
		attachSource(url: string): void;
		on(type: string, listener: (e: unknown) => void): void;
		off(type: string, listener: (e: unknown) => void): void;
		play(): void;
		pause(): void;
		isPaused(): boolean;
		seek(value: number): void;
		duration(): number;
		time(): number;
		setVolume(value: number): void;
		getVolume(): number;
		updateSettings(settings: unknown): void;
		reset(): void;
		destroy(): void;
		[key: string]: unknown;
	}

	export interface MediaPlayerFactory {
		create(): MediaPlayerClass;
	}

	export const MediaPlayer: {
		(): MediaPlayerFactory;
		events: Record<string, string>;
	};

	const dashjs: {
		MediaPlayer: typeof MediaPlayer;
	};
	export default dashjs;
}
