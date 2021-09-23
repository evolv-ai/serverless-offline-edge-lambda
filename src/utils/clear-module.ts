/*
 * <3 Lovingly borrowed from https://github.com/dherault/serverless-offline/blob/master/src/lambda/handler-runner/in-process-runner/InProcessRunner.js
 */
import * as path from "path";
import * as fs from "fs";

interface ClearModuleOpts {
    cleanup: boolean
}

export const clearModule = (filePath: string, opts: ClearModuleOpts) => {
	const options = opts ?? {};

    if(!require || !require.cache){
        return
    }

	if (!require.cache[filePath]) {
		const dirname = path.dirname(filePath);
		for (const fn of fs.readdirSync(dirname)) {
			const fullPath = path.resolve(dirname, fn);
			if (
				fullPath.substr(0, filePath.length + 1) === `${filePath}.` &&
				require.cache[fullPath]
			) {
				filePath = fullPath;
				break;
			}
		}
	}
    
	if (require.cache[filePath]) {

		// Remove file from parent cache
		if (require?.cache[filePath]?.parent) {
			let i = require?.cache[filePath]?.parent?.children.length;
			if (i) {
				do {
					i -= 1;
					if (require?.cache[filePath]?.parent?.children[i].id === filePath) {
						require?.cache[filePath]?.parent?.children.splice(i, 1);
					}
				} while (i);
			}
		}
		const cld = require?.cache[filePath]?.children;
		delete require.cache[filePath];
		for (const c of cld as NodeJS.Module[]) {
			// Unload any non node_modules children
			if (!c.filename.match(/node_modules/)) {
				clearModule(c.id, { ...options, cleanup: false });
			}
		}
		if (opts.cleanup) {
			// Cleanup any node_modules that are orphans
			let cleanup = false;
			do {
				cleanup = false;
				for (const fn of Object.keys(require.cache)) {
					if (
						require?.cache[fn]?.id !== "." &&
						require?.cache[fn]?.parent &&
						require?.cache[fn]?.parent?.id !== "." &&
						!require.cache[require?.cache[fn]?.parent?.id as string]
					) {
						delete require.cache[fn];
						cleanup = true;
					}
				}
			} while (cleanup);
		}
	}
};
