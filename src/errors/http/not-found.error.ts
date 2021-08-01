import { StatusCodes } from "http-status-codes";
import { HttpError } from "./http.error";

export class NotFoundError extends HttpError {
    constructor(message: string, lastError: Error|null = null){
        super(message, StatusCodes.NOT_FOUND, lastError)
    }
}