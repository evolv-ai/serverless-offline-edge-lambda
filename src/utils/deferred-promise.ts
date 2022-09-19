/**
 * The `DeferredPromise` class provides a mechanism for resolving a promise from outside
 * its executor function.
 */
export class DeferredPromise<T> implements Promise<T> {
	public resolve!: (value: T) => void;
	public reject!: (err?: any) => void;

	private readonly promise: Promise<T>;

	[Symbol.toStringTag] = 'Promise';

	constructor() {
		this.promise = new Promise<T>((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		});
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): Promise<TResult1 | TResult2> {
		return this.promise.then(onfulfilled, onrejected);
	}

	catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> {
		return this.promise.catch(onrejected);
	}

	finally(onfinally?: (() => void) | undefined | null): Promise<T> {
		return this.promise.finally(onfinally);
	}
}
