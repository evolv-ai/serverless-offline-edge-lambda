import { CloudFrontHeaders } from 'aws-lambda';
import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';


export function toCloudFrontHeaders(headers: IncomingHttpHeaders | OutgoingHttpHeaders): CloudFrontHeaders {
	return Object.entries(headers)
		.reduce((acc, [key, value]) => {
			acc[key.toLowerCase()] = [{
				key,
				value: value as string
			}];

			return acc;
		}, {} as CloudFrontHeaders);
}
