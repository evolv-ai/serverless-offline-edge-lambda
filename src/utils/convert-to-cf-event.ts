import { CloudFrontRequestEvent } from 'aws-lambda';
import { IncomingMessage } from 'http';
import { parse, UrlWithStringQuery } from 'url';

import { CloudFrontConfig } from '../types';
import { toCloudFrontHeaders } from './convert-headers';


export type IncomingMessageWithBodyAndCookies = IncomingMessage & {
	body: any;
	cookies: Record<string, string>;
};

export function convertToCloudFrontEvent(req: IncomingMessageWithBodyAndCookies, config: CloudFrontConfig, customHeaders: Record<string, string>): CloudFrontRequestEvent {
	const url = parse(req.url as string, false) as UrlWithStringQuery;
	const request = {
		clientIp: req.socket.remoteAddress as string,
		method: req.method as string,
		headers: toCloudFrontHeaders({...customHeaders, ...req.headers}),
		uri: url.href as string,
		querystring:  url.query || '',
		body: req.body,
		cookies: req.cookies
	};

	return { Records: [{ cf: { config, request }}] };
}
