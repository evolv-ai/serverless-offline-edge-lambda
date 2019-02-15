import { CloudFrontResultResponse } from 'aws-lambda';

export function toResultResponse(value: any): CloudFrontResultResponse {
	return {
		status: '200',
		statusDescription: '',
		headers: {},
		bodyEncoding: 'text',
		body: value
	};
}
