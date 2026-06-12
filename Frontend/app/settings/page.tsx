"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { IconButton } from "@/components/ui/IconButton";
import { SettingsToggle } from "@/components/ui/SettingsToggle";
import { Dropdown } from "@/components/ui/Dropdown";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { FallbackImage } from "@/components/ui/FallbackImage";
import { Dialog } from "@/components/ui/Dialog";
import { usePlayer } from "@/context/PlayerContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useDialogState } from "@/hooks/useDialogState";
import { getSettings, updateSettings, type UserSettings } from "@/lib/api";

const QUALITY_OPTIONS = [
	{ value: "auto", label: "Automatic" },
	{ value: "low", label: "Low (24kbps)" },
	{ value: "normal", label: "Normal (96kbps)" },
	{ value: "high", label: "High (160kbps)" },
	{ value: "very-high", label: "Very High (320kbps)" },
	{ value: "lossless", label: "Lossless (24-bit/48kHz)" },
	{ value: "hi-res", label: "Hi-Res Lossless (24-bit/192kHz)" },
];

const DOWNLOAD_QUALITY_OPTIONS = [
	{ value: "normal", label: "Normal (96kbps)" },
	{ value: "high", label: "High (160kbps)" },
	{ value: "very-high", label: "Very High (320kbps)" },
	{ value: "lossless", label: "Lossless (24-bit/48kHz)" },
	{ value: "hi-res", label: "Hi-Res Lossless (24-bit/192kHz)" },
];

const DEFAULT_SETTINGS: UserSettings = {
	streamingQuality: "high",
	downloadQuality: "high",
	dataSaver: false,
	gaplessPlayback: true,
	automix: true,
	allowExplicit: true,
};

interface SettingsSectionProps {
	title: string;
	children: React.ReactNode;
}

function SettingsSection({ title, children }: SettingsSectionProps) {
	return (
		<div className="flex flex-col gap-4 border-b border-neutral-800 pb-6 last:border-0 last:pb-0">
			<h3 className="text-xs font-bold tracking-widest text-neutral-500 uppercase">
				{title}
			</h3>
			<div className="flex flex-col gap-1">{children}</div>
		</div>
	);
}

interface SettingsOptionProps {
	label: string;
	description?: string;
	children: React.ReactNode;
}

function SettingsOption({ label, description, children }: SettingsOptionProps) {
	return (
		<div className="group flex items-start justify-between gap-3 py-2 md:items-center md:gap-0">
			<div className="flex min-w-0 flex-col gap-1">
				<span className="text-base font-medium text-white transition-colors group-hover:text-white">
					{label}
				</span>
				{description && (
					<p className="text-sm text-neutral-400 md:line-clamp-2">
						{description}
					</p>
				)}
			</div>
			<div className="shrink-0 md:ml-6">{children}</div>
		</div>
	);
}

export default function SettingsPage() {
	const { user } = useAuth();
	const { toast } = useToast();
	const { mutate } = useSWRConfig();
	const {
		isOpen: aboutOpen,
		open: openAbout,
		close: closeAbout,
	} = useDialogState();

	// Real playback engine settings (persisted in the player / localStorage).
	const {
		smoothTransitions,
		setSmoothTransitions,
		normalizeVolume,
		setNormalizeVolume,
	} = usePlayer();

	// Backend-persisted per-user settings.
	const { data, mutate: mutateSettings } = useSWR("user-settings", () =>
		getSettings(),
	);
	const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

	useEffect(() => {
		if (data?.settings) setSettings(data.settings);
	}, [data]);

	const patch = async (partial: Partial<UserSettings>) => {
		const next = { ...settings, ...partial };
		setSettings(next); // optimistic
		try {
			const result = await updateSettings(partial);
			mutateSettings(result, { revalidate: false });
		} catch {
			toast({ message: "Couldn't save that setting", variant: "error" });
			mutateSettings();
		}
	};

	const restoreDefaults = async () => {
		await patch(DEFAULT_SETTINGS);
		toast("Settings restored to defaults");
	};

	const clearCache = () => {
		// Drop every SWR-cached response and revalidate lazily.
		mutate(() => true, undefined, { revalidate: false });
		toast("Cache cleared");
	};

	const displayName = user?.displayName ?? "You";

	return (
		<div className="flex w-full flex-col gap-6">
			<div className="flex items-center justify-between border-b border-neutral-800 py-2">
				<h1 className="text-3xl font-black text-white">Settings</h1>
				<ActionMenu
					trigger={<IconButton icon="More" alt="More options" />}
					items={[
						{
							label: "Restore Defaults",
							icon: "Reset",
							onClick: restoreDefaults,
						},
						{
							label: "About",
							icon: "Info",
							onClick: () => openAbout(),
						},
					]}
				/>
			</div>

			{/* Account Section */}
			<div className="flex items-center gap-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
				<div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-neutral-800">
					<FallbackImage
						src={null}
						fallbackType="Artist"
						alt={displayName}
						fill
						sizes="80px"
					/>
				</div>
				<div className="flex flex-1 flex-col gap-1">
					<h2 className="text-2xl font-bold text-white">{displayName}</h2>
					{user?.email && <p className="text-neutral-400">{user.email}</p>}
				</div>
			</div>

			{/* Streaming Section */}
			<SettingsSection title="Audio Quality">
				<SettingsOption
					label="Streaming quality"
					description="Select how high your audio quality should be when streaming."
				>
					<Dropdown
						options={QUALITY_OPTIONS}
						value={settings.streamingQuality}
						onChange={(v) => patch({ streamingQuality: v })}
						align="right"
					/>
				</SettingsOption>
				<SettingsOption
					label="Download quality"
					description="Select the quality level for your downloaded songs."
				>
					<Dropdown
						options={DOWNLOAD_QUALITY_OPTIONS}
						value={settings.downloadQuality}
						onChange={(v) => patch({ downloadQuality: v })}
						align="right"
					/>
				</SettingsOption>
				<SettingsOption
					label="Volume normalization"
					description="Levels loudness across tracks so nothing is jarringly loud or quiet."
				>
					<SettingsToggle
						enabled={normalizeVolume}
						onChange={setNormalizeVolume}
					/>
				</SettingsOption>
				<SettingsOption
					label="Data Saver"
					description="Sets your audio quality to low and disables canvases."
				>
					<SettingsToggle
						enabled={settings.dataSaver}
						onChange={(v) => patch({ dataSaver: v })}
					/>
				</SettingsOption>
			</SettingsSection>

			{/* Playback Section */}
			<SettingsSection title="Playback">
				<SettingsOption
					label="Crossfade"
					description="Smoothly fades the end of each track into the next."
				>
					<SettingsToggle
						enabled={smoothTransitions}
						onChange={setSmoothTransitions}
					/>
				</SettingsOption>
				<SettingsOption
					label="Gapless Playback"
					description="Seamlessly transitions between songs in an album."
				>
					<SettingsToggle
						enabled={settings.gaplessPlayback}
						onChange={(v) => patch({ gaplessPlayback: v })}
					/>
				</SettingsOption>
				<SettingsOption
					label="Automix"
					description="Allows smooth transitions between songs in a playlist."
				>
					<SettingsToggle
						enabled={settings.automix}
						onChange={(v) => patch({ automix: v })}
					/>
				</SettingsOption>
				<SettingsOption
					label="Allow explicit content"
					description="Turn off to skip explicit content. This setting is shared across all devices."
				>
					<SettingsToggle
						enabled={settings.allowExplicit}
						onChange={(v) => patch({ allowExplicit: v })}
					/>
				</SettingsOption>
			</SettingsSection>

			{/* Storage Section */}
			<SettingsSection title="Storage">
				<SettingsOption
					label="Clear Cache"
					description="Empty the in-app cache of temporary music and image data."
				>
					<button
						onClick={clearCache}
						className="rounded-lg border border-neutral-700 px-4 py-2 font-medium text-white transition-colors hover:bg-neutral-800"
					>
						Clear
					</button>
				</SettingsOption>
			</SettingsSection>

			<Dialog isOpen={aboutOpen} onClose={closeAbout} title="About Muse">
				<div className="space-y-3 text-sm text-neutral-300">
					<p>Muse — discover and stream music in hi-fi.</p>
					<p className="text-neutral-500">
						A personal, fully-free music player. No ads, no subscriptions.
					</p>
				</div>
			</Dialog>
		</div>
	);
}
