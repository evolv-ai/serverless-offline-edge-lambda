
declare type Annotated<T> = T & { path?: string };

declare class FlatCache {

	getKey(key: string): any;

	setKey(key: string, value: any): void;

	removeKey(key: string): void;

	all(): object;

	save(noPrune?: boolean): void;
}

declare module 'flat-cache' {

	interface FlatCacheStatic {
		load(name: string, path?: string): FlatCache;

		clearCacheById(name: string): void;

		clearAll(): void;
	}

	const flatCache: FlatCacheStatic;

	export = flatCache;
}
