import { NextFunction } from 'connect';
import { IncomingMessage, ServerResponse } from 'http';


export type AsyncHandler<T extends IncomingMessage> = (req: T, res: ServerResponse, next: NextFunction) => Promise<any>;

export function asyncMiddleware<T extends IncomingMessage>(fn: AsyncHandler<T>) {
	return (req: IncomingMessage, res: ServerResponse, next: NextFunction) =>
		fn(req as T, res, next).catch(next);
}
