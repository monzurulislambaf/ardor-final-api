import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { exampleController } from './example.controller';
import { createExampleSchema, listExamplesQuerySchema, updateExampleSchema } from './example.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate({ query: listExamplesQuerySchema }), exampleController.list);
router.post('/', validate({ body: createExampleSchema }), exampleController.create);
router.get('/:id', validate({ params: idParamsSchema }), exampleController.getById);
router.patch(
  '/:id',
  validate({ params: idParamsSchema, body: updateExampleSchema }),
  exampleController.update,
);
router.delete('/:id', validate({ params: idParamsSchema }), exampleController.remove);

export default router;
