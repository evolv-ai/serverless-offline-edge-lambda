import { CloudFrontRequestEvent, CloudFrontResponseEvent, CloudFrontResultResponse } from 'aws-lambda';
import flatCache from 'flat-cache';

import { CacheId } from '../constants';


export class CacheService {
	private cache: FlatCache;

	constructor(private cacheDir: string) {
		this.cache = flatCache.load(CacheId, cacheDir);
	}

	retrieveFromCache(event: CloudFrontRequestEvent) {
		const { request } = event.Records[0].cf;
		const { uri } = request;

		return this.cache.getKey(uri);
	}

	saveToCache(event: CloudFrontResponseEvent) {
		const { request } = event.Records[0].cf;
		const { uri } = request;

		const { body } = event.Records[0].cf.response as CloudFrontResultResponse;

		this.cache.setKey(uri, body);
		this.cache.save();
	}

	public async purge() {
		flatCache.clearCacheById(CacheId);

		// FIXME Workaround. Bug in flat-cache clear methods.
		Object.entries(this.cache.all()).forEach(entry => {
			this.cache.removeKey(entry[0]);
		});
	}
}
