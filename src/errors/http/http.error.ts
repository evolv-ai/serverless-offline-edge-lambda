import { getReasonPhrase } from "http-status-codes"

interface HttpErrorResponse {
    code: number,
    message: string
}

export class HttpError extends Error{
    public statusCode: number
    public message: string
    public reasonPhrase: string|number
    public originalError: Error|null

    constructor(message: string, statusCode: number, originalError: Error|null = null){
        super(message)
        this.message = message
        this.statusCode = statusCode

        try{
            this.reasonPhrase = getReasonPhrase(statusCode)
        } catch {
            this.reasonPhrase = 'Unknown'
        }
        
        this.originalError = originalError
    }

    public getResponsePayload(): HttpErrorResponse{
        return {
            code: this.statusCode,
            message: this.message
        }
    }
}