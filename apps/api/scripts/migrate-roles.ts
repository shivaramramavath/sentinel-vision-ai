import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import { normalizeRole, ROLE_KEYS } from '@sentinel/shared-types';

dotenv.config({ path: 'apps/api/.env' });
dotenv.config({ path: '.env' });

async function migrateRoles() {
  const isDryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/sentinel_vision';

  console.log(`\n================ ROLE MIGRATION TOOL ================`);
  console.log(`Connecting to MongoDB...`);
  console.log(`Dry-run mode: ${isDryRun ? 'ENABLED (no changes will be written)' : 'DISABLED (live database update)'}\n`);

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection('users');

    const users = await usersCollection.find({}).toArray();
    console.log(`Found ${users.length} total user records to evaluate.`);

    let updatedCount = 0;
    let unchangedCount = 0;

    for (const user of users) {
      const currentRole = user.role;
      const canonicalRole = normalizeRole(currentRole);

      if (currentRole !== canonicalRole) {
        console.log(`[MIGRATE] User "${user.email}" (${user._id}): "${currentRole}" -> "${canonicalRole}"`);
        if (!isDryRun) {
          await usersCollection.updateOne(
            { _id: user._id },
            { $set: { role: canonicalRole } }
          );
        }
        updatedCount++;
      } else {
        unchangedCount++;
      }
    }

    console.log(`\nMigration completed summary:`);
    console.log(`- Total inspected: ${users.length}`);
    console.log(`- Roles normalized: ${updatedCount}`);
    console.log(`- Already canonical: ${unchangedCount}`);
    if (isDryRun) {
      console.log(`\n* DRY RUN ONLY — Run without --dry-run to commit updates.\n`);
    } else {
      console.log(`\n* Database successfully migrated to canonical roles.\n`);
    }
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

migrateRoles();
