import { Context } from 'aws-lambda';
import bodyParser from 'body-parser';
import { isBoom } from 'boom';
import * as Boom from 'boom';
import connect, { HandleFunction } from 'connect';
import cookieParser from 'cookie-parser';
import flatCache from 'flat-cache';
import * as fs from 'fs-extra';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { NOT_FOUND, OK } from 'http-status-codes';
import * as os from 'os';
import { join, resolve } from 'path';
import { URL } from 'url';

import { CacheId } from './constants';
import { FunctionSet } from './function-set';
import { asyncMiddleware } from './middlewares';
import { CloudFrontLifecycle, OriginService } from './services';
import { ServerlessInstance, ServerlessOptions } from './types';
import {
	buildConfig, buildContext, CloudFrontHeadersHelper, ConfigBuilder, convertToCloudFrontEvent, IncomingMessageWithBodyAndCookies
} from './utils';


export class BehaviorRouter {
	private builder: ConfigBuilder;
	private cache: FlatCache;
	private context: Context;
	private behaviors = new Map<string, FunctionSet>();

	private cacheDir: string;
	private fileDir: string;
	private path: string;

	private originService: OriginService;
	private log: (message: string) => void;

	constructor(
		private serverless: ServerlessInstance,
		private options: ServerlessOptions
	) {
		this.log = serverless.cli.log.bind(serverless.cli);

		this.builder = buildConfig(serverless);
		this.context = buildContext();

		this.cacheDir = resolve(options.cacheDir || join(os.tmpdir(), 'edge-lambda'));
		this.fileDir = resolve(options.fileDir || join(os.tmpdir(), 'edge-lambda'));
		this.path = this.serverless.service.custom.offlineEdgeLambda.path || '';

		fs.mkdirpSync(this.cacheDir);
		fs.mkdirpSync(this.fileDir);

		this.originService = new OriginService(this.cacheDir, this.fileDir);
		this.cache = flatCache.load(CacheId, this.cacheDir);
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

		return null;
	}

	async listen(port: number) {
		try {
			await this.extractBehaviors();
			this.logStorage();
			this.logBehaviors();

			const app = connect();

			app.use(bodyParser());
			app.use(cookieParser() as HandleFunction);
			app.use(asyncMiddleware(async (req: IncomingMessageWithBodyAndCookies, res: ServerResponse) => {
				if ((req.method || '').toUpperCase() === 'PURGE') {
					await this.purgeStorage();

					res.statusCode = OK;
					res.end();
					return;
				}

				const handler = this.match(req);
				const cfEvent = convertToCloudFrontEvent(req, this.builder('viewer-request'));

				if (!handler) {
					res.statusCode = NOT_FOUND;
					res.end();
					return;
				}

				try {
					const lifecycle = new CloudFrontLifecycle(this.serverless, this.options, cfEvent, this.context, this.originService, handler);
					const response = await lifecycle.run(req.url as string);

					if (!response) {
						throw Boom.internal();
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
					if (isBoom(err)) {
						this.handleError(err, res);
						return;
					}
				}
			}));

			const server = createServer(app);

			return server.listen(port);
		} catch (err) {
			console.error(err);
			process.exit(1);
		}
	}

	public handleError(err: Boom<any>, res: ServerResponse) {
		res.statusCode = err.output.statusCode;
		res.statusMessage = err.output.payload.error;

		res.end(err.message);
	}

	public async purgeStorage() {
		this.originService.purge();
	}

	private async extractBehaviors() {
		const { functions } = this.serverless.service;

		const behaviors = this.behaviors;
		const lambdaDefs = Object.entries(functions)
			.filter(([, fn]) => 'lambdaAtEdge' in fn);

		behaviors.clear();

		for await (const [, def] of lambdaDefs) {
			const pattern = def.lambdaAtEdge.pathPattern || '*';

			if (!behaviors.has(pattern)) {
				behaviors.set(pattern, new FunctionSet(pattern, this.log));
			}

			const fnSet = behaviors.get(pattern) as FunctionSet;

			await fnSet.setHandler(def.lambdaAtEdge.eventType, join(this.path, def.handler));
		}
	}

	private logStorage() {
		this.log(`Cache directory: file://${this.cacheDir}`);
		this.log(`Files directory: file://${this.fileDir}`);
		console.log();
	}

	private logBehaviors() {
		this.behaviors.forEach((behavior, key) => {
			this.log(`Lambdas for path pattern ${key}: `);

			behavior.viewerRequest && this.log(`viewer-request => ${behavior.viewerRequest.path || ''}`);
			behavior.originRequest && this.log(`origin-request => ${behavior.originRequest.path || ''}`);
			behavior.originResponse && this.log(`origin-response => ${behavior.originResponse.path || ''}`);
			behavior.viewerResponse && this.log(`viewer-response => ${behavior.viewerResponse.path || ''}`);

			console.log(); // New line
		});
	}
}
