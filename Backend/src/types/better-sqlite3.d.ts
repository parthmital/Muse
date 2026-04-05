declare module "better-sqlite3" {
	export interface Statement {
		run(...params: unknown[]): any;
		get(...params: unknown[]): any;
		all(...params: unknown[]): any[];
	}

	export interface Database {
		prepare(sql: string): Statement;
		exec(sql: string): this;
		pragma(sql: string): unknown;
		transaction<T extends (...args: any[]) => any>(fn: T): T;
	}

	export default class BetterSqlite3Database implements Database {
		constructor(filename: string, options?: Record<string, unknown>);
		prepare(sql: string): Statement;
		exec(sql: string): this;
		pragma(sql: string): unknown;
		transaction<T extends (...args: any[]) => any>(fn: T): T;
	}
}
