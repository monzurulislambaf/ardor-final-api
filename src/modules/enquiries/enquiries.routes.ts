import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { enquiriesController } from './enquiries.controller';
import { createEnquirySchema, listEnquiriesQuerySchema, updateEnquirySchema } from './enquiries.schema';

const router = Router();

// Public: submit an enquiry
router.post('/', validate({ body: createEnquirySchema }), enquiriesController.create);

// Admin endpoints
router.use(authenticate);
router.get('/', authorize('admin', 'manager'), validate({ query: listEnquiriesQuerySchema }), enquiriesController.list);
router.get('/stats', authorize('admin', 'manager'), enquiriesController.stats);
router.get('/:id', authorize('admin', 'manager'), validate({ params: idParamsSchema }), enquiriesController.getById);
router.patch('/:id', authorize('admin'), validate({ params: idParamsSchema, body: updateEnquirySchema }), enquiriesController.update);
router.delete('/:id', authorize('admin'), validate({ params: idParamsSchema }), enquiriesController.remove);

export default router;
