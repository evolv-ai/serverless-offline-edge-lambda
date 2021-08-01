import { StatusCodes } from 'http-status-codes';
import { HttpError } from './http.error';

export class InternalServerError extends HttpError {
	constructor(message: string, lastError: Error|null = null) {
		super(message, StatusCodes.INTERNAL_SERVER_ERROR, lastError);
	}
}
