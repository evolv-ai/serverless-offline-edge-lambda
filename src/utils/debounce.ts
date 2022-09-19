export const debounce =
	function (func: { (eventName: any, srcPath: any): Promise<void>; apply?: any; }, threshold: number, execAsap: boolean) {
	let timeout: any;
	return function debounced(this: any) {
		const obj = this;
		const args = arguments;

		function delayed() {
			if (!execAsap) {
				func.apply(obj, args);
			}
			timeout = undefined;
		}

		if (timeout) {
			clearTimeout(timeout);
		} else if (execAsap) {
			func.apply(obj, args);
		}
		timeout = setTimeout(delayed, threshold || 100);
	};
};
