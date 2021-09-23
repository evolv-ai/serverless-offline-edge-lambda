import { CFDistribution } from "../types"

export function getCustomHeaders(resource: CFDistribution): Record<string, string>{
	return resource?.Properties?.DistributionConfig.Origins.reduce((acc, origin) => {
		// For each origin create a new list of headers
		let headers: Record<string, string> = {}

		origin.OriginCustomHeaders.forEach((header) => {
			headers[header.HeaderName] = header.HeaderValue
		})

		// And collapse the list of headers for the origin into the overall set of headers
		// for the distribution
		return {
			...acc,
			...headers
		}
	}, {} as Record<string, string>) || {}
}