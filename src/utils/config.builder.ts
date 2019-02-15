import { CloudFrontConfig, EventType, ServerlessInstance } from '../types';

export type ConfigBuilder = (eventType: EventType) => CloudFrontConfig;

export function buildConfig(serverless: ServerlessInstance): ConfigBuilder {
	return (eventType) => ({
		distributionDomainName: '',
		distributionId: '',
		eventType: eventType,
		requestId: ''
	});
}
