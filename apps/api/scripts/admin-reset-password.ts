import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AdminBootstrapService } from '../src/admin/admin-bootstrap.service';
import { promptText, promptHidden, validatePasswordComplexity } from './prompt-util';

async function main() {
  console.log('\n==========================================================');
  console.log('🔑 SENTINEL VISION AI — INTERACTIVE ADMIN PASSWORD RESET');
  console.log('==========================================================\n');

  const email = await promptText('Enter Super Admin Email');
  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }

  const password = await promptHidden('Enter New Passphrase (min 12 chars, upper/lower/digit/symbol, hidden): ');
  const complexity = validatePasswordComplexity(password);
  if (!complexity.valid) {
    console.error(`\n❌ Error: ${complexity.error}`);
    process.exit(1);
  }

  const confirmPassword = await promptHidden('Confirm New Passphrase (hidden): ');
  if (password !== confirmPassword) {
    console.error('\n❌ Error: Passphrases do not match.');
    process.exit(1);
  }

  console.log('\n⏳ Connecting to database and revoking existing sessions...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const adminBootstrapService = app.get(AdminBootstrapService);
    await adminBootstrapService.resetAdminPassword({
      email,
      newPassword: password,
      actorEmail: 'cli',
    });

    const domain = email.split('@')[1];
    console.log(`\n✅ SUCCESS: Password reset completed for super_admin on domain @${domain}.`);
    console.log('   All active device and web terminal sessions have been revoked.');
    console.log('   User will be forced to change password upon next login.');
  } catch (err: any) {
    console.error(`\n❌ Failed to reset admin password: ${err.message}`);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error in admin:reset-password:', err);
  process.exit(1);
});
