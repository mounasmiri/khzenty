import { Router } from 'express';

import { getMe, postLogin, postLogout, postRegister } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';

export const authRouter: Router = Router();

authRouter.post('/register', validateBody(registerSchema), postRegister);
authRouter.post('/login', validateBody(loginSchema), postLogin);
authRouter.post('/logout', postLogout);
authRouter.get('/me', requireAuth, getMe);
