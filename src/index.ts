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
			edge: {
				lifecycleEvents: [
					'start'
				],
				commands: {
					start: {
						lifecycleEvents: [
							'start'
						],
						options: {
							cloudfrontPort: {
								default: 8080
							},
							disableCache: {
								default: false
							},
							cacheDir: {
								required: true
							},
							fileDir: {
								required: true
							},
							origin: {
								required: true
							}
						}
					}
				}
			}
		};

		this.hooks = {
			'edge:start:start': this.onStart.bind(this),
			'before:offline:start:init': this.onStart.bind(this),
			'before:offline:start:end': this.onEnd.bind(this),
		};
	}

	async onStart() {
		try {
			const port = this.options.cloudfrontPort || 8080;

			await this.server.listen(port);
			this.log(`CloudFront Offline listening on port ${port}`);
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
