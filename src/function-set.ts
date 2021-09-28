import {
	CloudFrontRequestEvent, CloudFrontRequestResult, CloudFrontResponseEvent, CloudFrontResponseResult, Context
} from 'aws-lambda';
import globToRegExp from 'glob-to-regexp';

import { Origin } from './services';
import { EventType } from './types';
import { CallbackPromise, ModuleLoader} from './utils';


export type AsyncCloudFrontRequestHandler = (event: CloudFrontRequestEvent, context: Context) => Promise<CloudFrontRequestResult>;
export type AsyncCloudFrontResponseHandler = (event: CloudFrontResponseEvent, context: Context) => Promise<CloudFrontResponseResult>;

const identityRequestHandler = async (event: CloudFrontRequestEvent) => event.Records[0].cf.request;
const identityResponseHandler = async (event: CloudFrontResponseEvent) => event.Records[0].cf.response;

export class FunctionSet {
	protected readonly moduleLoader: ModuleLoader = new ModuleLoader();

	public readonly regex: RegExp;

	viewerRequest: Annotated<AsyncCloudFrontRequestHandler> = identityRequestHandler;
	originRequest: Annotated<AsyncCloudFrontRequestHandler> = identityRequestHandler;
	originResponse: Annotated<AsyncCloudFrontResponseHandler> = identityResponseHandler;
	viewerResponse: Annotated<AsyncCloudFrontResponseHandler> = identityResponseHandler;

	constructor(
		public readonly pattern: string,
		private readonly log: (message: string) => void,
		public readonly origin: Origin = new Origin()
	) {
		this.regex = globToRegExp(pattern);
	}

	async setHandler(event: EventType, path: string) {
		switch (event) {
			case 'viewer-request': {
				this.viewerRequest = await this.getRequestHandler(path);
				return;
			}
			case 'viewer-response': {
				this.viewerResponse = await this.getResponseHandler(path);
				return;
			}
			case 'origin-request': {
				this.originRequest = await this.getRequestHandler(path);
				return;
			}
			case 'origin-response': {
				this.originResponse = await this.getResponseHandler(path);
				return;
			}
		}
	}

	async getRequestHandler(path: string): Promise<AsyncCloudFrontRequestHandler> {
		const fn = await this.moduleLoader.loadModule(path);

		const handler = async (event: CloudFrontRequestEvent, context: Context) => {
			const promise = new CallbackPromise();

			if (typeof fn !== 'function') {
				throw new Error(`Unable to find request handler under path: ${fn}. Please recheck your serverless.yml / exported handlers!`);
			}

			const result = fn(event, context, promise.callback) as CloudFrontRequestResult;

			if (result instanceof Promise) {
				return result;
			} else {
				return promise;
			}
		};

		handler.path = path;

		return handler;
	}

	async getResponseHandler(path: string): Promise<AsyncCloudFrontResponseHandler> {
		const fn = await this.moduleLoader.loadModule(path);

		const handler = async (event: CloudFrontResponseEvent, context: Context) => {
			const deferred = new CallbackPromise();
			const result = fn(event, context, deferred.callback) as CloudFrontResponseResult;

			if (result instanceof Promise) {
				return result;
			} else {
				return deferred;
			}
		};

		handler.path = path;

		return handler;
	}

	public purgeLoadedFunctions() {
		this.moduleLoader.purgeLoadedModules();
	}
}
