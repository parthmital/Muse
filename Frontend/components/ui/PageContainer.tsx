"use client";

import { ReactNode, createContext, useState } from "react";

interface PageContainerProps {
	children: ReactNode;
	className?: string;
}

interface PageColorContextType {
	setBgColor: (color: string) => void;
}

export const PageColorContext = createContext<PageColorContextType>({
	setBgColor: () => {},
});

export function PageContainer({
	children,
	className = "",
}: PageContainerProps) {
	const [bgColor, setBgColor] = useState<string>("");

	const transition =
		bgColor === ""
			? "none" // instant out
			: "background-color 1s ease"; // gradual in

	return (
		<PageColorContext.Provider value={{ setBgColor }}>
			<div
				className={`scrollbar-hide flex grow flex-col gap-6 overflow-y-auto rounded-lg border border-neutral-800 p-6 ${className}`}
				style={{
					backgroundColor: bgColor || "transparent",
					transition,
				}}
			>
				{children}
			</div>
		</PageColorContext.Provider>
	);
}
