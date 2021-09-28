import './polyfills';

import { BehaviorRouter } from './behavior-router';
import { ServerlessInstance, ServerlessOptions } from './types';


class OfflineEdgeLambdaPlugin {
	private commands: { [key: string]: any };
	private hooks: { [key: string]: Function };

	private server: BehaviorRouter;
	private log: (message: string) => void;

	constructor(
		private readonly serverless: ServerlessInstance,
		private readonly options: ServerlessOptions
	) {
		this.prepareCustomSection();

		this.server = new BehaviorRouter(serverless, options);
		this.log = serverless.cli.log.bind(serverless.cli);

		this.commands = {
			offline: {
				lifecycleEvents: [
					'start'
				],
				commands: {
					start: {
						lifecycleEvents: [
							'init',
							'end'
						],
						usage: 'Start the offline edge lambda server',
						options: {
							port: {
								usage: 'Specify the port that the server will listen on',
								default: 8080,
								type: 'string'
							},
							cloudfrontPort: {
								usage: '[Deprecated] Specify the port that the server will listen on. Use --port instead',
								type: 'string'
							},
							disableCache: {
								usage: 'Disables simulated cache',
								default: false,
								type: 'boolean'
							},
							cacheDir: {
								usage: 'Specify the directory where cache file will be stored',
								required: false,
								type: 'string'
							},
							fileDir: {
								usage: 'Specify the directory where origin requests will draw from',
								required: false,
								type: 'string'
							}
						}
					}
				}
			}
		};

		this.hooks = {
			'offline:start:init': this.onStart.bind(this),
			'offline:start:end': this.onEnd.bind(this),
			'webpack:compile:watch:compile': this.onReload.bind(this)
		};
	}

	async onStart() {
		try {
			const port = this.options.cloudfrontPort || this.options.port || 8080;

			this.log(`CloudFront Offline listening on port ${port}`);
			await this.server.start(port);
		} catch (err) {
			console.error(err);
		}
	}

	async onEnd() {
		await this.server.purgeStorage();
		this.log(`CloudFront Offline storage purged`);
	}

	async onReload() {
		// In the event we have not started the server yet or we are in the process of
		// restarting the server ignore our changes
		if (!this.server.hasStarted() || !this.server.isRunning()) {
			return;
		}

		console.log('Restarting server due to function update...');
		await this.server.restart();
	}

	private prepareCustomSection() {
		const { service } = this.serverless;
		service.custom = service.custom || {};

		const { custom } = this.serverless.service;
		custom.offlineEdgeLambda = custom.offlineEdgeLambda || {};
	}
}

export = OfflineEdgeLambdaPlugin;
