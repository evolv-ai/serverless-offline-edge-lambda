import { CloudFrontRequest, CloudFrontRequestEvent, CloudFrontResultResponse } from 'aws-lambda';
import * as fs from 'fs-extra';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';

import { parse } from 'url';
import { toHttpHeaders } from '../utils';
import { OutgoingHttpHeaders } from 'http';
import { InternalServerError, NotFoundError } from '../errors/http';
import { StatusCodes } from 'http-status-codes';


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
				statusDescription: 'OK',
				headers: {
					'content-type': [
						{ key: 'content-type', value: 'application/json' }
					]
				},
				bodyEncoding: 'text',
				body: contents
			};
		} catch (err) {
			// Make sure error gets back to user
			const status = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
			const reasonPhrase = err.reasonPhrase || 'Internal Server Error';
			return {
				status: status,
				statusDescription: reasonPhrase,
				headers: {
					'content-type': [
						{ key: 'content-type', value: 'application/json' }
					]
				},
				bodyEncoding: 'text',
				body: JSON.stringify({
					'code': status,
					'message': err.message
				})
			};
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
				throw new NotFoundError('Operation given as \'noop\'');
			}
			default: {
				throw new InternalServerError('Invalid request type (needs to be \'http\', \'https\' or \'file\')');
			}
		}
	}

	private async getFileResource(key: string): Promise<string> {
		const uri = parse(key);
		const fileName = uri.pathname;

		const fileTarget = `${this.baseUrl}/${fileName}`;

		// Check for if path given is accessible and is a file before fetching it
		try {
			await fs.access(fileTarget);
		} catch {
			throw new NotFoundError(`File ${fileTarget} does not exist`);
		}

		const fileState = await fs.lstat(fileTarget);
		if (!fileState.isFile()) {
			throw new NotFoundError(`${fileTarget} is not a file.`);
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
