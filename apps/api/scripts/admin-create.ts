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
  console.log('\n======================================================');
  console.log('👤 SENTINEL VISION AI — INTERACTIVE SUPER ADMIN CREATOR');
  console.log('======================================================\n');

  const email = await promptText('Enter Super Admin Email');
  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }

  const name = await promptText('Enter Full Name & Title', 'System Administrator');
  const badgeNumber = await promptText('Enter Badge Number', 'SA-0001');
  const department = await promptText('Enter Department', 'Platform Administration');

  const password = await promptHidden('Enter Passphrase (min 12 chars, upper/lower/digit/symbol, hidden): ');
  const complexity = validatePasswordComplexity(password);
  if (!complexity.valid) {
    console.error(`\n❌ Error: ${complexity.error}`);
    process.exit(1);
  }

  const confirmPassword = await promptHidden('Confirm Passphrase (hidden): ');
  if (password !== confirmPassword) {
    console.error('\n❌ Error: Passphrases do not match.');
    process.exit(1);
  }

  console.log('\n⏳ Bootstrapping application context and provisioning user...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const adminBootstrapService = app.get(AdminBootstrapService);
    const user = await adminBootstrapService.createAdmin({
      email,
      name,
      badgeNumber,
      department,
      password,
      mustChangePassword: true,
      mfaEnrollmentRequired: true,
    });

    const domain = email.split('@')[1];
    console.log(`\n✅ SUCCESS: Super Admin created for domain @${domain}.`);
    console.log(`   User ID: ${user._id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Must Change Password on First Login: Yes`);
    console.log(`   MFA Enrollment Required on First Login: Yes`);
  } catch (err: any) {
    console.error(`\n❌ Failed to create super admin: ${err.message}`);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error in admin:create:', err);
  process.exit(1);
});
