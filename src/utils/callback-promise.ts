import { DeferredPromise } from './deferred-promise';

/**
 * The `CallbackPromise` provides a mechanism for creating a promise that can be resolved or rejected
 * like a Node callback function.
 */
export class CallbackPromise<T = any> implements Promise<T> {
	public readonly callback: (...args: any[]) => void;
	private readonly promise = new DeferredPromise<T>();
	private hasBeenCalled: boolean = false;

	[Symbol.toStringTag] = 'Promise';

	constructor(strict: boolean = true) {
		this.callback = (err: any | null, result: T) => {
			if (strict && this.hasBeenCalled) {
				throw new Error('Callback has already been invoked');
			}

			this.hasBeenCalled = true;

			if (err) {
				this.promise.reject(err);
				return;
			}

			this.promise.resolve(result);
		};
	}

	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
	): Promise<TResult1 | TResult2> {
		return this.promise.then(onfulfilled);
	}

	catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult> {
		return this.promise.catch(onrejected);
	}

	finally(onfinally?: (() => void) | undefined | null): Promise<T> {
		return this.promise.finally(onfinally);
	}
}
