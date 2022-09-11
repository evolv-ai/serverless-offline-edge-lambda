import { Context } from 'aws-lambda';
import bodyParser from 'body-parser';
import connect, { HandleFunction } from 'connect';
import cookieParser from 'cookie-parser';
import * as chokidar from 'chokidar';
import * as fs from 'fs-extra';
import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { StatusCodes } from 'http-status-codes';
import * as os from 'os';
import * as path from 'path';
import { URL } from 'url';
import { debounce } from './utils/debounce';
import { HttpError, InternalServerError } from './errors/http';
import { FunctionSet } from './function-set';
import { asyncMiddleware, cloudfrontPost } from './middlewares';
import { CloudFrontLifecycle, Origin, CacheService } from './services';
import { CFDistribution, ServerlessInstance, ServerlessOptions } from './types';
import {
	buildConfig, buildContext, CloudFrontHeadersHelper, ConfigBuilder,
	convertToCloudFrontEvent, getOriginFromCfDistribution, IncomingMessageWithBodyAndCookies
} from './utils';


interface OriginMapping {
	pathPattern: string;
	target: string;
	default?: boolean;
}

export class BehaviorRouter {
	private builder: ConfigBuilder;
	private context: Context;
	private behaviors = new Map<string, FunctionSet>();
	private cfResources:  Record<string, CFDistribution>;

	private cacheDir: string;
	private fileDir: string;
	private path: string;

	private started: boolean = false;
	private origins: Map<string, Origin>;
	private restarting: boolean = false;
	private server: Server | null = null;
	private cacheService: CacheService;
	private log: (message: string) => void;

	constructor(
		private serverless: ServerlessInstance,
		private options: ServerlessOptions
	) {
		this.log = serverless.cli.log.bind(serverless.cli);

		this.builder = buildConfig(serverless);
		this.context = buildContext();

		this.cfResources = serverless.service?.resources?.Resources || {};
		this.cacheDir = path.resolve(options.cacheDir || path.join(os.tmpdir(), 'edge-lambda'));
		this.fileDir = path.resolve(options.fileDir || path.join(os.tmpdir(), 'edge-lambda'));
		this.path = this.serverless.service.custom.offlineEdgeLambda.path || '.';

		fs.mkdirpSync(this.cacheDir);
		fs.mkdirpSync(this.fileDir);

		this.origins = this.configureOrigins();
		this.cacheService = new CacheService(this.cacheDir);

		if (this.serverless.service.custom.offlineEdgeLambda.watchReload) {
			this.watchFiles(this.path + '/**/*', {
				ignoreInitial: true,
				awaitWriteFinish: true,
				interval: 500,
				debounce: 750,
				...options,
			});
		}
	}

	watchFiles(pattern: any, options: any) {
		const watcher = chokidar.watch(pattern, options);
		watcher.on('all', debounce(async (eventName, srcPath) => {
			console.log('Lambda files changed, syncing...');
			await this.extractBehaviors();
			console.log('Lambda files synced');
		}, options.debounce, true));
	}

	match(req: IncomingMessage): FunctionSet | null {
		if (!req.url) {
			return null;
		}

		const url = new URL(req.url, 'http://localhost');

		for (const [, handler] of this.behaviors) {
			if (handler.regex.test(url.pathname)) {
				return handler;
			}
		}

		return this.behaviors.get('*') || null;
	}

	async start(port: number) {
		this.started = true;

		return new Promise(async (res, rej) => {
			await this.listen(port);

			// While the server is in a "restarting state" just restart the server
			while (this.restarting) {
				this.restarting = false;
				await this.listen(port, false);
			}

			res('Server shutting down ...');
		});
	}

	public hasStarted() {
		return this.started;
	}

	public isRunning() {
		return this.server !== null;
	}

	public async restart() {
		if (this.restarting) {
			return;
		}

		this.restarting = true;

		this.purgeBehaviourFunctions();
		await this.shutdown();
	}

	private async shutdown() {
		if (this.server !== null) {
			await this.server.close();
		}
		this.server = null;
	}

	private async listen(port: number, verbose: boolean = true) {
		try {
			await this.extractBehaviors();

			if (verbose) {
				this.logStorage();
				this.logBehaviors();
			}
			const app = connect();

			app.use(cloudfrontPost());
			app.use(bodyParser());
			app.use(cookieParser() as HandleFunction);
			app.use(asyncMiddleware(async (req: IncomingMessageWithBodyAndCookies, res: ServerResponse) => {
				if ((req.method || '').toUpperCase() === 'PURGE') {
					await this.purgeStorage();

					res.statusCode = StatusCodes.OK;
					res.end();
					return;
				}

				const handler = this.match(req);

				if (!handler) {
					res.statusCode = StatusCodes.NOT_FOUND;
					res.end();
					return;
				}

				const customOrigin = handler.distribution in this.cfResources ?
					getOriginFromCfDistribution(handler.pattern, this.cfResources[handler.distribution]) :
					null;

				const cfEvent = convertToCloudFrontEvent(req, this.builder('viewer-request'));

				try {
					const lifecycle = new CloudFrontLifecycle(this.serverless, this.options, cfEvent,
																this.context, this.cacheService, handler, customOrigin);
					const response = await lifecycle.run(req.url as string);

					if (!response) {
						throw new InternalServerError('No response set after full request lifecycle');
					}

					res.statusCode = parseInt(response.status, 10);
					res.statusMessage = response.statusDescription || '';

					const helper = new CloudFrontHeadersHelper(response.headers);

					for (const { key, value } of helper.asHttpHeaders()) {
						if (value) {
							res.setHeader(key as string, value);
						}
					}

					res.end(response.body);
				} catch (err) {
					this.handleError(err, res);
					return;
				}
			}));


			return new Promise(resolve => {
				this.server = createServer(app);
				this.server.listen(port);
				this.server.on('close', (e: string) => {
					resolve(e);
				});
			});
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	}

	// Format errors
	public handleError(err: HttpError, res: ServerResponse) {
		res.statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;

		const payload = JSON.stringify(err.hasOwnProperty('getResponsePayload') ?
			err.getResponsePayload() :
			{
				code: StatusCodes.INTERNAL_SERVER_ERROR,
				message: err.stack || err.message
			}
		);

		res.end(payload);
	}

	public async purgeStorage() {
		this.cacheService.purge();
	}

	private configureOrigins(): Map<string, Origin> {
		const { custom } = this.serverless.service;
		const mappings: OriginMapping[] = custom.offlineEdgeLambda.originMap || [];

		return mappings.reduce((acc, item) => {
			acc.set(item.pathPattern, new Origin(item.target));
			return acc;
		}, new Map<string, Origin>());
	}

	private async extractBehaviors() {
		const { functions } = this.serverless.service;

		const behaviors = this.behaviors;
		const lambdaDefs = Object.entries(functions)
			.filter(([, fn]) => 'lambdaAtEdge' in fn);

		behaviors.clear();

		for await (const [, def] of lambdaDefs) {

			const pattern = def.lambdaAtEdge.pathPattern || '*';
			const distribution = def.lambdaAtEdge.distribution || '';

			if (!behaviors.has(pattern)) {
				const origin = this.origins.get(pattern);
				behaviors.set(pattern, new FunctionSet(pattern, distribution, this.log, origin));
			}

			const fnSet = behaviors.get(pattern) as FunctionSet;

			// Don't try to register distributions that come from other sources
			if (fnSet.distribution !== distribution) {
				this.log(`Warning: pattern ${pattern} has registered handlers for cf distributions ${fnSet.distribution}` +
						` and ${distribution}. There is no way to tell which distribution should be used so only ${fnSet.distribution}` +
						` has been registered.` );
				continue;
			}

			await fnSet.setHandler(def.lambdaAtEdge.eventType, path.join(this.path, def.handler));
		}

		if (!behaviors.has('*')) {
			behaviors.set('*', new FunctionSet('*', '', this.log, this.origins.get('*')));
		}
	}

	private purgeBehaviourFunctions() {
		this.behaviors.forEach((behavior) => {
			behavior.purgeLoadedFunctions();
		});
	}

	private logStorage() {
		this.log(`Cache directory: file://${this.cacheDir}`);
		this.log(`Files directory: file://${this.fileDir}`);
		console.log();
	}

	private logBehaviors() {
		this.behaviors.forEach((behavior, key) => {

			this.log(`Lambdas for path pattern ${key}` +
				(behavior.distribution === '' ? ':' : ` on ${behavior.distribution}:`)
			);

			behavior.viewerRequest && this.log(`viewer-request => ${behavior.viewerRequest.path || ''}`);
			behavior.originRequest && this.log(`origin-request => ${behavior.originRequest.path || ''}`);
			behavior.originResponse && this.log(`origin-response => ${behavior.originResponse.path || ''}`);
			behavior.viewerResponse && this.log(`viewer-response => ${behavior.viewerResponse.path || ''}`);

			console.log(); // New line
		});
	}
}
