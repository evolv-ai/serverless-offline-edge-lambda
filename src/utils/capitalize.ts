export function capitalize(value: string) {
	if (typeof value !== 'string') {
		throw new TypeError('Expected a string');
	}

	return value.toLowerCase().replace(/(?:^|\s|-)\S/g, str => str.toUpperCase());
}
