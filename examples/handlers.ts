import {
	Callback, CloudFrontRequestEvent, CloudFrontResponseEvent,
	CloudFrontResultResponse, Context, Handler
} from 'aws-lambda';
import * as fs from 'fs-extra';

// With a callback

export const onViewerRequest: Handler =
	(event: CloudFrontRequestEvent, context: Context, callback: Callback<CloudFrontResultResponse>) => {
		fs.readFile('message.txt', 'utf-8', (err: Error, contents: string) => {
			callback(null, {
				status: 'OK',
				body: contents
			});
		});
	};

// With a promise

export const onOriginRequest: Handler =
	(event: CloudFrontRequestEvent, context: Context, callback: Callback): Promise<CloudFrontResultResponse> => {
		return new Promise((resolve, reject) => {
			resolve({
				status: 'OK',
				body: JSON.stringify({})
			});
		});
	};

// async-await

export const onOriginResponse: Handler =
	async (event: CloudFrontResponseEvent, context: Context): Promise<CloudFrontResultResponse> => {
		try {
			const contents = await fs.readFile('message.txt', 'utf-8');

			return {
				status: 'OK',
				body: contents
			};
		} catch (err) {
			throw err;
		}
	};

export const onViewerResponse: Handler =
	async (event: CloudFrontResponseEvent, context: Context): Promise<CloudFrontResultResponse> => {
		try {
			const contents = await fs.readFile('message.txt', 'utf-8');

			return {
				status: 'OK',
				body: contents
			};
		} catch (err) {
			throw err;
		}
	};
