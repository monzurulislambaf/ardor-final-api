import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { uploadFiles } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { expertsController } from './experts.controller';
import { createExpertSchema, listExpertsQuerySchema, publicExpertsQuerySchema, updateExpertSchema } from './experts.schema';

const router = Router();

// Public endpoints
router.get('/public', validate({ query: publicExpertsQuerySchema }), expertsController.listPublic);
router.get('/public/featured', expertsController.getFeatured);
router.get('/public/counts', expertsController.countByCategory);
router.get('/public/:slug', expertsController.getBySlug);

// Admin endpoints
router.use(authenticate);
router.get('/', authorize('admin', 'manager', 'super_admin'), validate({ query: listExpertsQuerySchema }), expertsController.list);
router.post('/', authorize('admin', 'super_admin'), validate({ body: createExpertSchema }), expertsController.create);
// multipart/form-data, single image in field "photo"; returns { url } to store on the expert.
router.post('/photo', authorize('admin', 'super_admin', 'expert'), uploadFiles('photo', 1), expertsController.uploadPhoto);
router.get('/:id', authorize('admin', 'manager', 'super_admin'), validate({ params: idParamsSchema }), expertsController.getById);
router.patch('/:id', authorize('admin', 'super_admin'), validate({ params: idParamsSchema, body: updateExpertSchema }), expertsController.update);
router.delete('/:id', authorize('admin', 'super_admin'), validate({ params: idParamsSchema }), expertsController.remove);

export default router;
