import { CloudFrontOrigin, CloudFrontS3Origin, CloudFrontCustomOrigin, CloudFrontHeaders } from 'aws-lambda';
import { CFOrigin, CFDistribution, CFCustomHeaders, CacheBehaviors, CFOriginProtocolPolicy } from '../types';
import {toCloudFrontHeaders} from './convert-headers';
import { IncomingHttpHeaders } from 'http';

/**
 * Extracts the lambda@edge event origin based on the current path pattern and CF details
 * @param targetPathPattern
 * @param resource
 * @returns
 */
export function getOriginFromCfDistribution(targetPathPattern: string, resource: CFDistribution): CloudFrontOrigin | null {
	const origins = resource?.Properties?.DistributionConfig?.Origins;
	const cacheBehaviors = resource?.Properties?.DistributionConfig?.CacheBehaviors;

	if (!origins || !cacheBehaviors) {
		return null;
	}

	const origin = getCFOriginForPathPattern(targetPathPattern, origins, cacheBehaviors);

	if (!origin) {
		return null;
	}

	if (origin?.CustomOriginConfig) {
		return {
			custom: getCustomOriginDetails(origin)
		};
	}

	if (origin?.S3OriginConfig) {
		return {
			s3: getS3OriginDetails(origin)
		};
	}

	return null;
}

/**
 * Extracts the CF origin matching a given path pattern using the cache behaviors as is done in the CF
 * @param targetPathPattern
 * @param origins
 * @param cacheBehaviors
 */
function getCFOriginForPathPattern(targetPathPattern: string, origins: CFOrigin[], cacheBehaviors: CacheBehaviors[]): CFOrigin | null {
	const cacheBehaviour = cacheBehaviors.find((item) => item.PathPattern === targetPathPattern);

	if (!cacheBehaviour) {
		return null;
	}

	return origins.find((origin) => origin.Id === cacheBehaviour.TargetOriginId) || null;
}

/**
 * Handler for fetching generic information shared between s3 and custom endpoints
 * @param origin
 */
function getGenericOriginDetails(origin: CFOrigin): {
	keepaliveTimeout: number
	customHeaders: CloudFrontHeaders
	domainName: string
} {
	return {
		// Default connection timeout is 10 seconds
		keepaliveTimeout: origin?.ConnectionTimeout || 10,
		customHeaders: getCustomHeaders(origin?.OriginCustomHeaders || []),
		domainName: origin.DomainName,
	};
}

/**
 * Gets details on a given s3 origin
 * @param origin
 * @returns
 */
function getS3OriginDetails(origin: CFOrigin): CloudFrontS3Origin {
	return {
		...getGenericOriginDetails(origin),
		domainName: origin.DomainName,
		// No clue on how to get this so hard coded for now
		authMethod: 'none',
		region: 'us-east-2',
		path: ''
	};
}

/**
 * Get details on a custom origin
 * @param origin
 * @returns
 */
function getCustomOriginDetails(origin: CFOrigin): CloudFrontCustomOrigin {
	const customOriginConfig = origin.CustomOriginConfig;
	return {
		...getGenericOriginDetails(origin),
		port: ((customOriginConfig?.OriginProtocolPolicy === CFOriginProtocolPolicy.HTTPS_ONLY ?
			customOriginConfig?.HTTPSPort :
			customOriginConfig?.HTTPPort) as number),
		// No clue on how to get this so hard coded for now
		path: '',
		protocol: customOriginConfig?.OriginProtocolPolicy  === CFOriginProtocolPolicy.HTTPS_ONLY ?
			'https' :
			'http' ,
		readTimeout: customOriginConfig?.OriginReadTimeout as number,
		sslProtocols: customOriginConfig?.OriginSSLProtocols as string[]

	};
}

/**
 * Converts CF custom headers to event custom headers
 * @param customHeaders
 * @returns
 */
function getCustomHeaders(customHeaders: CFCustomHeaders[]): CloudFrontHeaders {
	const headers: IncomingHttpHeaders = {};

	for (const header of customHeaders) {
		headers[header.HeaderName] = header.HeaderValue;
	}

	return toCloudFrontHeaders(headers);
}
