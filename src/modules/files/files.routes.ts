import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { uploadFiles } from '../../middlewares/upload.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { filesController } from './files.controller';
import { listFilesQuerySchema } from './files.schema';

const router = Router();

router.use(authenticate);

// multipart/form-data. Images: field "images" (max 5). Any allowed file: field "files".
router.post('/images', uploadFiles('images', 5), filesController.uploadImages);
router.post('/', uploadFiles('files'), filesController.uploadFiles);

router.get('/', validate({ query: listFilesQuerySchema }), filesController.list);
router.get('/:id', validate({ params: idParamsSchema }), filesController.getById);
router.get('/:id/download', validate({ params: idParamsSchema }), filesController.download);
router.get('/:id/view', validate({ params: idParamsSchema }), filesController.view);
router.delete('/:id', validate({ params: idParamsSchema }), filesController.remove);

export default router;
