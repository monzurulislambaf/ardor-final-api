import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { idParamsSchema } from '../../utils/object-id';
import { usersController } from './users.controller';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateProfileSchema,
  updateUserSchema,
} from './users.schema';

const router = Router();

router.use(authenticate);

// Current user's own profile (declared before "/:id" so "me" is not treated as an id).
router.get('/me', usersController.getProfile);
router.patch('/me', validate({ body: updateProfileSchema }), usersController.updateProfile);

// Administration
router.get(
  '/',
  authorize('admin', 'manager'),
  validate({ query: listUsersQuerySchema }),
  usersController.list,
);
router.post('/', authorize('admin'), validate({ body: createUserSchema }), usersController.create);
router.get(
  '/:id',
  authorize('admin', 'manager'),
  validate({ params: idParamsSchema }),
  usersController.getById,
);
router.patch(
  '/:id',
  authorize('admin'),
  validate({ params: idParamsSchema, body: updateUserSchema }),
  usersController.update,
);
router.delete('/:id', authorize('admin'), validate({ params: idParamsSchema }), usersController.remove);

export default router;
