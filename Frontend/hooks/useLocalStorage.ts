"use client";

import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
	// State to store our value
	const [storedValue, setStoredValue] = useState<T>(initialValue);
	const [isInitialized, setIsInitialized] = useState(false);

	// Initialize from localStorage on mount
	useEffect(() => {
		try {
			const item = window.localStorage.getItem(key);
			if (item) {
				setStoredValue(JSON.parse(item));
			}
		} catch (error) {
			console.error(`Error loading ${key} from localStorage:`, error);
		} finally {
			setIsInitialized(true);
		}
	}, [key]);

	// Return a wrapped version of useState's setter function that persists to localStorage
	const setValue = (value: T | ((val: T) => T)) => {
		try {
			// Allow value to be a function so we have same API as useState
			const valueToStore =
				value instanceof Function ? value(storedValue) : value;
			setStoredValue(valueToStore);
			window.localStorage.setItem(key, JSON.stringify(valueToStore));
		} catch (error) {
			console.error(`Error saving ${key} to localStorage:`, error);
		}
	};

	return [storedValue, setValue, isInitialized] as const;
}
