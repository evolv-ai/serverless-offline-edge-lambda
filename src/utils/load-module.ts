import { resolve } from 'path';
import { clearModule } from './clear-module';

export class ModuleLoader {
	protected loadedModules: string[] = [];

	async loadModule(path: string): Promise<Function> {
		const regex = /(.+)\.(.+)/;
		const match = regex.exec(path);

		if (!match) {
			throw new Error('Could not find module');
		}

		const [, modulePath, functionName] = match;
		const absPath = resolve(modulePath);

		delete require.cache[require.resolve(absPath)];
		const module = await import(absPath);

		this.loadedModules.push(absPath);

		return module[functionName];
	}

	public purgeLoadedModules() {
		this.loadedModules.forEach((module) => {
			clearModule(module, {
				cleanup: true
			});
		});

		this.loadedModules = [];
	}
}
