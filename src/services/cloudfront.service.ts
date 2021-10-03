import {
	CloudFrontRequestEvent, CloudFrontResponseResult, CloudFrontOrigin, Context
} from 'aws-lambda';

import { NoResult } from '../errors';
import { FunctionSet } from '../function-set';
import { combineResult, isResponseResult, toResultResponse } from '../utils';
import { CacheService } from './cache.service';
import { ServerlessInstance, ServerlessOptions } from '../types';


export class CloudFrontLifecycle {

	private readonly log: (message: string) => void;

	constructor(
		private readonly serverless: ServerlessInstance,
		private options: ServerlessOptions,
		private event: CloudFrontRequestEvent,
		private context: Context,
		private fileService: CacheService,
		private fnSet: FunctionSet,
		private origin: CloudFrontOrigin | null,
	) {
		this.log = serverless.cli.log.bind(serverless.cli);
	}

	async run(url: string): Promise<CloudFrontResponseResult | void> {
		this.log(`Request for ${url}`);

		try {
			return await this.onViewerRequest();
		} catch (err) {
			if (!(err instanceof NoResult)) {
				throw err;
			}
		}

		try {
			return await this.onCache();
		} catch (err) {
			if (!(err instanceof NoResult)) {
				throw err;
			}
		}

		const result = await this.onOriginRequest();

		await this.fileService.saveToCache(combineResult(this.event, result));

		return await this.onViewerResponse(result);
	}

	async onViewerRequest() {
		this.log('→ viewer-request');

		const result = await this.fnSet.viewerRequest(this.event, this.context);

		if (isResponseResult(result)) {
			return this.onViewerResponse(result);
		}

		throw new NoResult();
	}

	async onViewerResponse(result: CloudFrontResponseResult) {
		this.log('← viewer-response');

		const event = combineResult(this.event, result);
		return this.fnSet.viewerResponse(event, this.context);
	}

	async onCache() {
		this.log('→ cache');

		if (this.options.disableCache) {
			this.log('✗ Cache disabled');
			throw new NoResult();
		}

		const cached = this.fileService.retrieveFromCache(this.event);

		if (!cached) {
			this.log('✗ Cache miss');

			throw new NoResult();
		} else {
			this.log('✓ Cache hit');
			throw new NoResult();
		}

		const result = toResultResponse(cached);
		return this.onViewerResponse(result);
	}

	async onOrigin() {
		this.log('→ origin');
		return await this.fnSet.origin.retrieve(this.event);
	}

	async onOriginRequest() {
		this.log('→ origin-request');

		// Inject origin into request once we reach the origin request step
		// as it is not available in viewer requests
		this.injectOriginIntoRequest();

		const result = await this.fnSet.originRequest(this.event, this.context);

		if (isResponseResult(result)) {
			return result;
		}

		const resultFromOrigin = await this.onOrigin();

		return this.onOriginResponse(resultFromOrigin);
	}

	async onOriginResponse(result: CloudFrontResponseResult) {
		this.log('← origin-response');

		const event = combineResult(this.event, result);
		return this.fnSet.originResponse(event, this.context);
	}

	protected injectOriginIntoRequest() {
		if (this?.event?.Records[0]?.cf?.request && this.origin !== null) {
			this.event.Records[0].cf.request.origin = this.origin;
		}
	}
}
