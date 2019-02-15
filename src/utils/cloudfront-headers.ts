import { CloudFrontHeaders } from 'aws-lambda';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';


export type HeaderValue = number | string | string[] | undefined;
export type HttpHeader = keyof IncomingHttpHeaders | keyof OutgoingHttpHeaders;

export function addHeader(key: string, value: string, headers: CloudFrontHeaders): CloudFrontHeaders {
	const normalized = normalizeKey(key);
	const newHeaders: CloudFrontHeaders = {
		[normalized]: [],
		...headers,
	};

	newHeaders[normalized].push({ key, value });

	return newHeaders;
}

export function getHeader(key: string, headers: CloudFrontHeaders): HeaderValue | null {
	const subheaders = getHeaders(key, headers);

	if (!subheaders || subheaders.length === 0) {
		return null;
	}

	return subheaders[0];
}

export function getHeaders(key: string, headers: CloudFrontHeaders): HeaderValue[] | null {
	const normalized = normalizeKey(key);

	if (!(normalized in headers)) {
		return null;
	}

	return headers[normalized].map(header => header.value);
}

export function hasHeader(key: string, headers: CloudFrontHeaders): boolean {
	const subheaders = getHeaders(key, headers);
	return (subheaders !== null && subheaders.length > 0);
}

export function toHttpHeaders(headers: CloudFrontHeaders) {
	return Object.entries(headers)
		.reduce((acc, [key, subheaders]) => {
			acc.push({
				key,
				value: subheaders.map(sh => sh.value)
			});

			return acc;
		}, [] as Array<{ key: string, value: any | any[] }>);
}

export function normalizeKey(key: string): string {
	return key.toLowerCase();
}

export function initializeKey(key: string, headers: CloudFrontHeaders) {
	const normalized = normalizeKey(key);

	if (!headers[normalized] || headers[normalized].length === 0) {
		headers[normalized] = [];
	}
}

export function setHeader(key: string, value: string, headers: CloudFrontHeaders): CloudFrontHeaders {
	const normalized = normalizeKey(key);
	const newHeaders: CloudFrontHeaders = {
		...headers,
		[normalized]: []
	};

	newHeaders[normalized].push({ key, value });

	return newHeaders;
}

export class CloudFrontHeadersHelper {

	constructor(private headers: CloudFrontHeaders = {}) {}

	getHeader(key: string): HeaderValue | null {
		return getHeader(key, this.headers);
	}

	getHeaders(key: string): HeaderValue[] | null {
		return getHeaders(key, this.headers);
	}

	addHeader(key: string, value: string): void {
		this.headers = addHeader(key, value, this.headers);
	}

	hasHeader(key: string): boolean {
		return hasHeader(key, this.headers);
	}

	setHeader(key: string, value: string): void {
		this.headers = setHeader(key, value, this.headers);
	}

	asHttpHeaders() {
		return toHttpHeaders(this.headers);
	}

	asCloudFrontHeaders() {
		return this.headers;
	}

	static from(headers: IncomingHttpHeaders | OutgoingHttpHeaders): CloudFrontHeadersHelper {
		const cfHeaders = Object.entries(headers)
			.reduce((acc, [key, value]) => {
				acc[key.toLowerCase()] = [{
					key,
					value: value as string
				}];

				return acc;
			}, {} as CloudFrontHeaders);

		return new CloudFrontHeadersHelper(cfHeaders);
	}
}
