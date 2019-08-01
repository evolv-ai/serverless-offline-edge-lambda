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
								default: 8080
							},
							cloudfrontPort: {
								usage: '[Deprecated] Specify the port that the server will listen on. Use --port instead',
								default: 8080
							},
							disableCache: {
								usage: 'Disables simulated cache',
								default: false
							},
							cacheDir: {
								usage: 'Specify the directory where cache file will be stored',
								required: false
							},
							fileDir: {
								usage: 'Specify the directory where origin requests will draw from',
								required: false
							}
						}
					}
				}
			}
		};

		this.hooks = {
			'offline:start:init': this.onStart.bind(this),
			'offline:start:end': this.onEnd.bind(this)
		};
	}

	async onStart() {
		try {
			const port = this.options.cloudfrontPort || this.options.port || 8080;

			this.log(`CloudFront Offline listening on port ${port}`);
			await this.server.listen(port);
		} catch (err) {
			console.error(err);
		}
	}

	async onEnd() {
		await this.server.purgeStorage();
		this.log(`CloudFront Offline storage purged`);
	}
}

export = OfflineEdgeLambdaPlugin;
