import {
	CloudFrontRequestEvent, CloudFrontResponse, CloudFrontResponseEvent, CloudFrontResponseResult
} from 'aws-lambda';

export function combineResult<T extends CloudFrontRequestEvent | CloudFrontResponseEvent>(
	request: T,
	result: CloudFrontResponseResult | null
): CloudFrontResponseEvent {
	return {
		Records: [{
			cf: {
				config: request.Records[0].cf.config,
				request: request.Records[0].cf.request,
				response: result as CloudFrontResponse
			}
		}]
	};
}
