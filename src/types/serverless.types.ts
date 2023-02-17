
export interface ServerlessInstance {
	cli: {
		log(str: string): void
	};
	config: {
		servicePath: string
	};
	service: {
		custom: Record<string, any>;
		provider: {
			name: string
		}
		functions: { [key: string]: ServerlessFunction }
		package: ServerlessPackage
		resources?: {
			Resources?: Record<string, CFDistribution>
		}
		getAllFunctions: () => string[]
	};
	pluginManager: PluginManager;
}

/**
 * A stub for the CF distributions we want details for in the context of this app
 */
export interface CFDistribution {
	Type: string;
	Properties: {
		DistributionConfig: {
			Origins: CFOrigin[]
			CacheBehaviors: CacheBehaviors[]
		}
	};
}

export interface CacheBehaviors {
	PathPattern: string;
	TargetOriginId: string;
}

export interface CFOrigin {
	DomainName: string;
	Id: string;
	ConnectionTimeout: number;
	OriginCustomHeaders: CFCustomHeaders[];
	S3OriginConfig?: {
		OriginAccessIdentity: string
	};
	CustomOriginConfig?: CFCustomOriginConfig;
}


export enum CFOriginProtocolPolicy {
	HTTP_ONLY = 'http-only',
	MATCH_VIEWER = 'match-viewer',
	HTTPS_ONLY = 'https-only'
}

export interface CFCustomOriginConfig {
	HTTPPort?: number;
	HTTPSPort: number;
	OriginKeepaliveTimeout: string;
	OriginProtocolPolicy: CFOriginProtocolPolicy;
	OriginReadTimeout: number;
	OriginSSLProtocols: ('SSLv3' | 'TLSv1' | 'TLSv1.1' | 'TLSv1.2')[];
}
export interface CFCustomHeaders {
	HeaderName: string;
	HeaderValue: string;
}

export interface ServerlessOptions {
	cacheDir: string;
	cloudfrontPort: number;
	disableCache: boolean;
	fileDir: string;
	port: number;
	headersFile: string;
}

export interface EdgeLambdaOptions {
	distribution: string;
	eventType: | 'origin-request' | 'origin-response' | 'viewer-request' | 'viewer-response';
	pathPattern: string;
}

export interface ServerlessFunction {
	name: string;
	handler: string;
	package: ServerlessPackage;
	lambdaAtEdge: EdgeLambdaOptions;
}

export interface ServerlessPackage {
	include: string[];
	exclude: string[];
	artifact?: string;
	individually?: boolean;
}

export interface PluginManager {
	spawn(command: string): Promise<void>;
}
