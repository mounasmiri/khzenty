import { Router } from 'express';

import { postUploadSignature } from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const uploadRouter: Router = Router();

// Applied to the whole router: a signature must never be issued anonymously,
// since the folder it authorises is derived from the caller's id.
uploadRouter.use(requireAuth);

uploadRouter.post('/signature', postUploadSignature);
