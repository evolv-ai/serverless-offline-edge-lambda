import { CloudFrontResponseResult } from 'aws-lambda';

export function isResponseResult(value: any): value is CloudFrontResponseResult {
	return 'status' in value && 'body' in value;
}
