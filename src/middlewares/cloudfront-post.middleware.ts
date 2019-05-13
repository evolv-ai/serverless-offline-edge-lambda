import bodyParser from 'body-parser';
import { NextFunction } from 'express';


export function cloudfrontPost() {
	return (req: any, res: any, next: NextFunction) => {
		if (req.method === 'POST') {
			bodyParser.raw({type: '*/*'})(req, res, (err) => {
				if (err) {
					next(err);
				}

				req.body = {data: req.body};

				next();
			});
		} else {
			next();
		}
	};
}
