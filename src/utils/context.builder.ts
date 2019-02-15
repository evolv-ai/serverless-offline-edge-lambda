import { Context } from 'aws-lambda';

export function buildContext(): Context {
	return {
		callbackWaitsForEmptyEventLoop: true,
		functionName: '',
		functionVersion: '',
		invokedFunctionArn: '',
		memoryLimitInMB: 128,
		awsRequestId: '',
		logGroupName: '',
		logStreamName: '',

		getRemainingTimeInMillis() {
			return Infinity;
		},

		done() {},
		fail() {},
		succeed(messageOrObject: any) {},
	};
}
