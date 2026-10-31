import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { dashboardController } from './dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/admin', authorize('admin', 'manager'), dashboardController.adminStats);
router.get('/client', dashboardController.clientStats);

export default router;
