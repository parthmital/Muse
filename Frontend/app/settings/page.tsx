"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { SettingsToggle } from "@/components/ui/SettingsToggle";
import { Dropdown } from "@/components/ui/Dropdown";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { FallbackImage } from "@/components/ui/FallbackImage";

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
		<div className="group flex items-center justify-between py-2">
			<div className="flex min-w-0 flex-col gap-1">
				<span className="text-base font-medium text-white transition-colors group-hover:text-white">
					{label}
				</span>
				{description && (
					<p className="line-clamp-2 text-sm text-neutral-400">{description}</p>
				)}
			</div>
			<div className="ml-6 shrink-0">{children}</div>
		</div>
	);
}

export default function SettingsPage() {
	// Account state
	const [userName] = useState("Parth Mital");
	const [userEmail] = useState("parth@example.com");

	// Playback state
	const [streamingQuality, setStreamingQuality] = useState("very-high");
	const [downloadQuality, setDownloadQuality] = useState("very-high");
	const [crossfade, setCrossfade] = useState(false);
	const [gapless, setGapless] = useState(true);
	const [automix, setAutomix] = useState(true);
	const [explicitContent, setExplicitContent] = useState(true);

	const [dataSaver, setDataSaver] = useState(false);

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
							onClick: () => console.log("Restore Defaults"),
						},
						{
							label: "Help & Support",
							icon: "Help",
							onClick: () => console.log("Help"),
						},
						{
							label: "About",
							icon: "Info",
							onClick: () => console.log("About"),
						},
					]}
				/>
			</div>

			{/* Account Section */}
			<div className="flex items-center gap-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
				<div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-neutral-800">
					<FallbackImage src={null} fallbackType="Artist" alt="User" fill />
				</div>
				<div className="flex flex-1 flex-col gap-1">
					<h2 className="text-2xl font-bold text-white">{userName}</h2>
					<p className="text-neutral-400">{userEmail}</p>
				</div>
				<button className="rounded-full border border-neutral-700 px-6 py-2 font-bold text-white transition-colors hover:bg-neutral-800">
					Edit Profile
				</button>
			</div>

			{/* Streaming Section */}
			<SettingsSection title="Audio Quality">
				<SettingsOption
					label="Streaming quality"
					description="Select how high your audio quality should be when streaming."
				>
					<Dropdown
						options={QUALITY_OPTIONS}
						value={streamingQuality}
						onChange={setStreamingQuality}
						align="right"
					/>
				</SettingsOption>
				<SettingsOption
					label="Download quality"
					description="Select the quality level for your downloaded songs."
				>
					<Dropdown
						options={DOWNLOAD_QUALITY_OPTIONS}
						value={downloadQuality}
						onChange={setDownloadQuality}
						align="right"
					/>
				</SettingsOption>
				<SettingsOption
					label="Data Saver"
					description="Sets your audio quality to low and disables canvases."
				>
					<SettingsToggle enabled={dataSaver} onChange={setDataSaver} />
				</SettingsOption>
			</SettingsSection>

			{/* Playback Section */}
			<SettingsSection title="Playback">
				<SettingsOption
					label="Crossfade"
					description="Allows you to crossfade between songs."
				>
					<SettingsToggle enabled={crossfade} onChange={setCrossfade} />
				</SettingsOption>
				<SettingsOption
					label="Gapless Playback"
					description="Seamlessly transitions between songs in an album."
				>
					<SettingsToggle enabled={gapless} onChange={setGapless} />
				</SettingsOption>
				<SettingsOption
					label="Automix"
					description="Allows smooth transitions between songs in a playlist."
				>
					<SettingsToggle enabled={automix} onChange={setAutomix} />
				</SettingsOption>
				<SettingsOption
					label="Allow explicit content"
					description="Turn off to skip explicit content. This setting is shared across all devices."
				>
					<SettingsToggle
						enabled={explicitContent}
						onChange={setExplicitContent}
					/>
				</SettingsOption>
			</SettingsSection>

			{/* Storage Section */}
			<SettingsSection title="Storage">
				<SettingsOption
					label="Clear Cache"
					description="Empty the storage used for temporary music files. Currently: 1.2 GB"
				>
					<button className="rounded-lg border border-neutral-700 px-4 py-2 font-medium text-white transition-colors hover:bg-neutral-800">
						Clear
					</button>
				</SettingsOption>
			</SettingsSection>
		</div>
	);
}
