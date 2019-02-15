import { CloudFrontRequestEvent, CloudFrontResponseEvent, CloudFrontResultResponse } from 'aws-lambda';
import flatCache from 'flat-cache';
import * as fs from 'fs-extra';

import { CacheId } from '../constants';


export class OriginService {
	private cache: FlatCache;

	constructor(private cacheDir: string, private fileDir: string) {
		this.cache = flatCache.load(CacheId, cacheDir);
	}

	async getFile(key: string): Promise<string> {
		return await fs.readFile(`${this.fileDir}/${key}`, 'utf-8');
	}

	async saveFile(key: string, contents: string): Promise<void> {
		await fs.writeFile(`${this.fileDir}/${key}`, contents);
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

	async retrieveFromFS(event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> {
		const { request } = event.Records[0].cf;
		const { uri } = request;

		try {
			const filePath = uri.replace(/^https?:\/\//, '').replace(/^\//, '');
			const contents = await this.getFile(filePath);

			return {
				status: '200',
				statusDescription: '',
				headers: {},
				bodyEncoding: 'text',
				body: contents
			}
		} catch (err) {
			return {
				status: '404',
				statusDescription: '',
				headers: {}
			};
		}
	}

	public async purge() {
		await fs.remove(this.fileDir);

		flatCache.clearCacheById(CacheId);

		// FIXME Workaround. Bug in flat-cache clear methods.
		Object.entries(this.cache.all()).forEach(entry => {
			this.cache.removeKey(entry[0]);
		});
	}
}
