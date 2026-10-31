/**
 * Creates (or promotes) an admin user.
 *
 *   npm run create-admin -- admin@example.com 'StrongPass123' 'Admin Name'
 *
 * Public registration always creates regular users, so this is how you get
 * the first admin. The password is validated with the same rules as the API.
 */
import { connectDatabase, disconnectDatabase } from '../config/database';
import { createUserSchema } from '../modules/users/users.schema';
import { usersService } from '../modules/users/users.service';
import { UserModel } from '../modules/users/users.model';

const main = async (): Promise<void> => {
  const [email, password, name = 'Administrator'] = process.argv.slice(2);

  const parsed = createUserSchema.safeParse({ name, email, password, role: 'admin' });
  if (!parsed.success) {
    console.error('Usage: npm run create-admin -- <email> <password> [name]\n');
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  await connectDatabase();
  try {
    const existing = await UserModel.findOne({ email: parsed.data.email });
    if (existing) {
      existing.role = 'admin';
      existing.status = 'active';
      await existing.save();
      console.log(`Existing user ${existing.email} promoted to admin.`);
    } else {
      const user = await usersService.create(parsed.data);
      console.log(`Admin user ${user.email} created.`);
    }
  } finally {
    await disconnectDatabase();
  }
};

main().catch((error) => {
  console.error('Failed to create admin:', error instanceof Error ? error.message : error);
  process.exit(1);
});
