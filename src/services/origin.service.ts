import { CloudFrontRequest, CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda';
import {notFound as notFoundError, internal as internalError} from 'boom';
import * as fs from 'fs-extra';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

import { parse } from 'url';
import { toHttpHeaders } from '../utils';
import { OutgoingHttpHeaders } from 'http';


export class Origin {
	private readonly type: 'http' | 'https' | 'file' | 'noop' = 'http';

	constructor(public readonly baseUrl: string = '') {
		const regex = /^https?:\/\//;

		if (!baseUrl) {
			this.type = 'noop';
		} else if (/^http:\/\//.test(baseUrl)) {
			this.type = 'http';
		}  else if (/^https:\/\//.test(baseUrl)) {
			this.type = 'https';
		} else {
			this.baseUrl = path.resolve(baseUrl);
			this.type = 'file';
		}
	}

	async retrieve(event: CloudFrontRequestEvent): Promise<CloudFrontResultResponse> {
		const { request } = event.Records[0].cf;

		try {
			const contents = await this.getResource(request);

			return {
				status: '200',
				statusDescription: '',
				headers: {
					'content-type': [
						{ key: 'content-type', value: 'application/json' }
					]
				},
				bodyEncoding: 'text',
				body: contents
			};
		} catch (err) {
			let status = err.isBoom ? err.output.statusCode : 500
			return {
				status: status,
				statusDescription: err.message,
				headers: {
					'content-type': [
						{ key: 'content-type', value: 'application/json' }
					]
				},
				bodyEncoding: 'text',
				body: JSON.stringify({
					"code": status,
					"message": err.message
				})
			}
		}
	}

	async getResource(request: CloudFrontRequest): Promise<string> {
		const { uri: key } = request;

		switch (this.type) {
			case 'file': {				
				return this.getFileResource(key);
			}
			case 'http':
			case 'https': {
				return await this.getHttpResource(request);
			}
			case 'noop': {
				throw notFoundError();
			}
			default: {
				throw internalError('Invalid origin type');
			}
		}
	}

	private async getFileResource(key: string): Promise<string> {
		const uri = parse(key);
		const fileName = uri.pathname;

		const fileTarget = `${this.baseUrl}/${fileName}`;

		// Check for if file is a file befor fetching it
		try{
			await fs.access(fileTarget)
		} catch {
			throw notFoundError(`File ${fileTarget} does not exist`);
		}

		const fileState = await fs.lstat(fileTarget)
		if(!fileState.isFile()){
			throw notFoundError(`${fileTarget} is not a file.`);
		}

		return await fs.readFile(`${this.baseUrl}/${fileName}`, 'utf-8');
	}

	private async getHttpResource(request: CloudFrontRequest): Promise<string> {
		const httpModule = (this.type === 'https') ? https : http;

		const uri = parse(request.uri);
		const baseUrl = parse(this.baseUrl);

		const headers = toHttpHeaders(request.headers).reduce((acc, item) => {
			acc[item.key] = item.value[0];
			return acc;
		}, {} as OutgoingHttpHeaders);

		const options: http.RequestOptions = {
			method: request.method,
			protocol: baseUrl.protocol,
			hostname: baseUrl.hostname,
			port: baseUrl.port || (baseUrl.protocol === 'https:') ? 443 : 80,
			path: uri.path,
			headers: {
				...headers,
				Connection: 'Close'
			}
		};

		return new Promise((resolve, reject) => {
			const req = httpModule.request(options, (res: http.IncomingMessage) => {
				const chunks: Uint8Array[] = [];

				res.on('data', (chunk: Uint8Array) => {
					chunks.push(chunk);
				});

				res.on('close', () => {
					resolve(Buffer.concat(chunks).toString());
				});
				res.on('error', (err: Error) => reject(err));
			});

			req.end();
		});
	}
}
