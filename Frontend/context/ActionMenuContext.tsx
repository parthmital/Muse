"use client";

import {
	createContext,
	useContext,
	useState,
	useCallback,
	ReactNode,
} from "react";

interface ActionMenuInstance {
	id: string;
	x: number;
	y: number;
	isOpen: boolean;
}

interface ActionMenuContextType {
	activeMenu: ActionMenuInstance | null;
	openMenu: (id: string, x?: number, y?: number) => void;
	closeMenu: () => void;
	isMenuOpen: (id: string) => boolean;
}

const ActionMenuContext = createContext<ActionMenuContextType | undefined>(
	undefined,
);

export function ActionMenuProvider({ children }: { children: ReactNode }) {
	const [activeMenu, setActiveMenu] = useState<ActionMenuInstance | null>(null);

	const openMenu = useCallback((id: string, x?: number, y?: number) => {
		setActiveMenu({
			id,
			x: x ?? 0,
			y: y ?? 0,
			isOpen: true,
		});
	}, []);

	const closeMenu = useCallback(() => {
		setActiveMenu(null);
	}, []);

	const isMenuOpen = useCallback(
		(id: string) => {
			return activeMenu?.id === id && activeMenu?.isOpen;
		},
		[activeMenu],
	);

	return (
		<ActionMenuContext.Provider
			value={{ activeMenu, openMenu, closeMenu, isMenuOpen }}
		>
			{children}
		</ActionMenuContext.Provider>
	);
}

export function useActionMenu() {
	const context = useContext(ActionMenuContext);
	if (context === undefined) {
		throw new Error("useActionMenu must be used within an ActionMenuProvider");
	}
	return context;
}
