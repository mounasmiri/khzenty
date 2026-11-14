import { Router } from 'express';

import {
  getDemoAvailable,
  getMe,
  postDemoLogin,
  postLogin,
  postLogout,
  postRegister,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireDemoEnabled } from '../middlewares/demo-enabled.middleware.js';
import { loginLimiter, registerLimiter } from '../middlewares/rate-limit.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';

export const authRouter: Router = Router();

authRouter.post('/register', registerLimiter, validateBody(registerSchema), postRegister);
authRouter.post('/login', loginLimiter, validateBody(loginSchema), postLogin);
// Demo sign-in. The flag check comes first so a disabled deployment answers an
// ordinary 404 and spends no rate-limit budget; the limiter is the same one
// login uses, so the two share a budget and demo cannot be a way around it.
authRouter.get('/demo', requireDemoEnabled, getDemoAvailable);
authRouter.post('/demo', requireDemoEnabled, loginLimiter, postDemoLogin);
authRouter.post('/logout', postLogout);
authRouter.get('/me', requireAuth, getMe);
