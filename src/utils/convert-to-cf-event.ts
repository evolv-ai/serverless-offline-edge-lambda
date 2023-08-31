import { CloudFrontRequestEvent } from 'aws-lambda';
import { IncomingMessage } from 'http';
import fs from 'fs';
import { parse, UrlWithStringQuery } from 'url';

import { CloudFrontConfig } from '../types';
import { toCloudFrontHeaders } from './convert-headers';

function readInjectedHeadersFile(injectedHeadersFile: string): Record<string, string> {
	const headers = fs.readFileSync(injectedHeadersFile, 'utf8');
	return JSON.parse(headers);
}

export type IncomingMessageWithBodyAndCookies = IncomingMessage & {
	body: any;
	cookies: Record<string, string>;
};

export function convertToCloudFrontEvent(
	req: IncomingMessageWithBodyAndCookies,
	config: CloudFrontConfig,
	injectedHeadersFile?: string
): CloudFrontRequestEvent {
	const url = parse(req.url as string, false) as UrlWithStringQuery;

	const injectedHeaders = injectedHeadersFile ? readInjectedHeadersFile(injectedHeadersFile) : {};

	const request = {
		clientIp: req.socket.remoteAddress as string,
		method: req.method as string,
		headers: toCloudFrontHeaders({...req.headers, ...injectedHeaders}),
		uri: url.pathname as string,
		querystring:  url.query || '',
		body: req.body,
		cookies: req.cookies
	};

	return { Records: [{ cf: { config, request }}] };
}
