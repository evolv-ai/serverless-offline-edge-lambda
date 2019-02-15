export type EventType = 'origin-request' | 'origin-response' | 'viewer-request' | 'viewer-response';

export interface CloudFrontConfig {
	distributionDomainName: string;
	distributionId: string;
	eventType: EventType;
	requestId: string;
}
