import { resolve } from 'path';

export async function loadModule(path: string): Promise<Function> {
	const regex = /(.+)\.(.+)/;
	const match = regex.exec(path);
	
	if (!match) {
		throw new Error('Could not find module');
	}
	
	const [, modulePath, functionName] = match;
	const absPath = resolve(modulePath);
	
	const module = await import(absPath);
	
	return module[functionName];
}
