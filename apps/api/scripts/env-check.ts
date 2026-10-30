import * as dotenv from 'dotenv';
import * as path from 'path';
import * as net from 'net';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { Kafka } from 'kafkajs';
import { v2 as cloudinary } from 'cloudinary';
import { Pinecone } from '@pinecone-database/pinecone';
import * as brevo from '@getbrevo/brevo';
import { EnvSchema } from '../src/config/env.schema';
import { printMaskedConfig } from '../src/config/utils/masked-config-printer';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN' | 'SKIP';
  message: string;
  hint?: string;
  required: boolean;
}

const results: CheckResult[] = [];

function record(res: CheckResult) {
  results.push(res);
  const icon =
    res.status === 'PASS'
      ? '✅ [PASS]'
      : res.status === 'WARN'
      ? '⚠️ [WARN]'
      : res.status === 'SKIP'
      ? '⏭️ [SKIP]'
      : '❌ [FAIL]';
  console.log(`${icon} ${res.name.padEnd(28)}: ${res.message}`);
  if (res.hint) {
    console.log(`     👉 HINT: ${res.hint}`);
  }
}

async function runChecks() {
  console.log('\n================================================================');
  console.log('🔍 SENTINEL VISION AI — ENVIRONMENT VERIFICATION SUITE');
  console.log('================================================================\n');

  // Step 1: Validate Schema
  const parseResult = EnvSchema.safeParse(process.env);
  if (!parseResult.success) {
    console.error('❌ Zod Environment Schema Validation Failed:\n');
    for (const issue of parseResult.error.issues) {
      console.error(`  - Field: ${issue.path.join('.')} -> ${issue.message}`);
    }
    process.exit(1);
  }

  const env = parseResult.data;
  printMaskedConfig(process.env);
  console.log('\n--- Running Live Integration Health Checks ---\n');

  // Check 1: MongoDB Atlas Ping & ReplicaSet / Transactions
  try {
    const conn = await mongoose.createConnection(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    }).asPromise();

    const adminDb = conn.db?.admin();
    const hello = await adminDb?.command({ hello: 1 });
    const isReplica = Boolean(hello?.setName || hello?.hosts);

    await conn.close();

    if (isReplica) {
      record({
        name: 'MongoDB Atlas',
        status: 'PASS',
        message: `Connected successfully. ReplicaSet: '${hello?.setName || 'active'}' (Transactions supported).`,
        required: true,
      });
    } else {
      record({
        name: 'MongoDB Atlas',
        status: 'WARN',
        message: 'Connected, but deployment does not report a replica set. Multi-document transactions may fail.',
        hint: 'Use a MongoDB Atlas cluster or initiate a replica set in local mongo.',
        required: true,
      });
    }
  } catch (err: any) {
    const isTimeout =
      err.message?.includes('timed out') || err.name === 'MongooseServerSelectionError';
    record({
      name: 'MongoDB Atlas',
      status: 'FAIL',
      message: `Connection failed: ${err.message}`,
      hint: isTimeout
        ? 'Network timeout. Ensure your current public IP is added in Atlas Network Access (IP Access List).'
        : 'Verify MONGODB_URI username and password credentials.',
      required: true,
    });
  }

  // Check 2: Redis AUTH, PING, & AOF
  try {
    const redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await redis.connect();
    const pong = await redis.ping();
    const info = await redis.info('persistence');
    const aofEnabled = info.includes('aof_enabled:1');

    await redis.quit();

    if (pong === 'PONG') {
      record({
        name: 'Redis',
        status: aofEnabled ? 'PASS' : 'WARN',
        message: `PING returned ${pong}. AOF persistence: ${aofEnabled ? 'ENABLED' : 'DISABLED'}`,
        hint: aofEnabled
          ? undefined
          : 'Enable AOF in Redis for crash-resilient session storage (--appendonly yes --appendfsync everysec).',
        required: true,
      });
    }
  } catch (err: any) {
    record({
      name: 'Redis',
      status: 'FAIL',
      message: `Connection failed: ${err.message}`,
      hint: 'Ensure Redis container is running on REDIS_HOST:REDIS_PORT and REDIS_PASSWORD matches.',
      required: true,
    });
  }

  // Check 3: Kafka Metadata
  try {
    const kafka = new Kafka({
      brokers: env.KAFKA_BROKERS.split(',').map((b) => b.trim()),
      clientId: 'env-checker',
      connectionTimeout: 4000,
      retry: { retries: 1 },
    });
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    await admin.disconnect();

    record({
      name: 'Kafka (KRaft)',
      status: 'PASS',
      message: `Cluster metadata reachable. Discovered ${topics.length} topics.`,
      required: true,
    });
  } catch (err: any) {
    record({
      name: 'Kafka (KRaft)',
      status: 'FAIL',
      message: `Connection failed: ${err.message}`,
      hint: 'Ensure Kafka is running and KAFKA_BROKERS is reachable.',
      required: true,
    });
  }

  // Check 4: Pinecone Indexes & Dimensions
  if (env.PINECONE_API_KEY) {
    try {
      const pc = new Pinecone({ apiKey: env.PINECONE_API_KEY });
      const indexList = await pc.listIndexes();
      const names = indexList.indexes?.map((i) => i.name) || [];

      const hasFace = names.includes(env.PINECONE_INDEX_FACE);
      const hasReid = names.includes(env.PINECONE_INDEX_REID);

      if (hasFace && hasReid) {
        const faceDesc = await pc.describeIndex(env.PINECONE_INDEX_FACE);
        const reidDesc = await pc.describeIndex(env.PINECONE_INDEX_REID);

        const faceOk = faceDesc.dimension === env.PINECONE_FACE_DIM && faceDesc.metric === 'cosine';
        const reidOk = reidDesc.dimension === env.PINECONE_REID_DIM && reidDesc.metric === 'cosine';

        if (faceOk && reidOk) {
          record({
            name: 'Pinecone Vector DB',
            status: 'PASS',
            message: `Indexes verified: ${env.PINECONE_INDEX_FACE} (${faceDesc.dimension}d, cosine), ${env.PINECONE_INDEX_REID} (${reidDesc.dimension}d, cosine).`,
            required: true,
          });
        } else {
          record({
            name: 'Pinecone Vector DB',
            status: 'FAIL',
            message: `Dimension/metric mismatch! face: ${faceDesc.dimension}d (${faceDesc.metric}), reid: ${reidDesc.dimension}d (${reidDesc.metric})`,
            hint: `Run 'pnpm pinecone:init' or recreate indexes with dimension 512 and cosine metric.`,
            required: true,
          });
        }
      } else {
        record({
          name: 'Pinecone Vector DB',
          status: 'WARN',
          message: `Connected, but missing required indexes (face: ${hasFace}, reid: ${hasReid}).`,
          hint: "Run 'pnpm pinecone:init' to create serverless vector indexes.",
          required: true,
        });
      }
    } catch (err: any) {
      record({
        name: 'Pinecone Vector DB',
        status: 'FAIL',
        message: `API check failed: ${err.message}`,
        hint: 'Verify PINECONE_API_KEY validity.',
        required: true,
      });
    }
  } else {
    record({
      name: 'Pinecone Vector DB',
      status: 'SKIP',
      message: 'PINECONE_API_KEY is not configured.',
      required: false,
    });
  }

  // Check 5: Cloudinary API Ping & Probe Round-Trip
  if (env.STORAGE_DRIVER === 'cloudinary') {
    try {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });

      const pingRes = await cloudinary.api.ping();
      if (pingRes.status === 'ok') {
        try {
          // Upload tiny probe file in _healthcheck
          const probeFolder = `${env.CLOUDINARY_ROOT_FOLDER}/_healthcheck`;
          const uploadRes = await cloudinary.uploader.upload(
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            {
              folder: probeFolder,
              public_id: `probe_${Date.now()}`,
              type: 'authenticated',
            },
          );

          if (uploadRes.public_id) {
            await cloudinary.uploader.destroy(uploadRes.public_id, {
              type: 'authenticated',
            });
          }

          record({
            name: 'Cloudinary Storage',
            status: 'PASS',
            message: `Ping OK. Authenticated upload & delete round-trip verified in ${probeFolder}.`,
            required: true,
          });
        } catch (uploadErr: any) {
          const errMsg = uploadErr.error?.message || uploadErr.message || String(uploadErr);
          const isPerm = errMsg.includes('missing permissions') || errMsg.includes('403');
          record({
            name: 'Cloudinary Storage',
            status: 'WARN',
            message: `API Ping OK, but upload probe failed: ${errMsg}`,
            hint: isPerm
              ? "Cloudinary Access Key lacks 'Media Management' (upload/write) permissions. In Cloudinary Console (Settings -> Access Keys), grant Read & Write permissions or generate a Full Access key."
              : 'Verify Cloudinary account upload quota and settings in Cloudinary Console.',
            required: false,
          });
        }
      }
    } catch (err: any) {
      record({
        name: 'Cloudinary Storage',
        status: 'FAIL',
        message: `API check failed: ${err.message}`,
        hint: 'Verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        required: true,
      });
    }
  } else {
    record({
      name: 'Storage Driver',
      status: 'PASS',
      message: `Configured to '${env.STORAGE_DRIVER}' mode.`,
      required: true,
    });
  }

  // Check 6: Email Transport (Brevo vs SMTP-dev)
  if (env.EMAIL_TRANSPORT === 'brevo') {
    try {
      const client = new brevo.BrevoClient({ apiKey: env.BREVO_API_KEY! });
      const account = await client.account.getAccount();

      const freeDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
      const senderDomain = env.BREVO_SENDER_EMAIL?.split('@')[1]?.toLowerCase() || '';
      const isFreeMail = freeDomains.includes(senderDomain);

      record({
        name: 'Brevo Email API',
        status: isFreeMail ? 'WARN' : 'PASS',
        message: `Account verified: '${account?.email || 'active'}'. Credits remaining: ${account?.plan?.[0]?.credits ?? 'N/A'}.`,
        hint: isFreeMail
          ? `BREVO_SENDER_EMAIL domain '${senderDomain}' is a free-mail domain. Brevo requires a verified custom sending domain in production.`
          : undefined,
        required: true,
      });
    } catch (err: any) {
      record({
        name: 'Brevo Email API',
        status: 'FAIL',
        message: `API verification failed: ${err.message}`,
        hint: 'Verify BREVO_API_KEY and account status in Brevo dashboard.',
        required: true,
      });
    }
  } else {
    // Probe SMTP-dev (Mailpit)
    const socket = new net.Socket();
    const canConnectSmtp = await new Promise<boolean>((resolve) => {
      socket.setTimeout(2500);
      socket.connect(env.SMTP_DEV_PORT || 1025, env.SMTP_DEV_HOST || 'localhost', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });

    record({
      name: 'SMTP Dev (Mailpit)',
      status: canConnectSmtp ? 'PASS' : 'WARN',
      message: canConnectSmtp
        ? `Reachable on ${env.SMTP_DEV_HOST}:${env.SMTP_DEV_PORT}.`
        : `Cannot connect to ${env.SMTP_DEV_HOST}:${env.SMTP_DEV_PORT}.`,
      hint: canConnectSmtp ? undefined : 'Start Mailpit with docker compose for local email testing.',
      required: false,
    });
  }

  // Check 7: OAuth Providers (Format & Callback Matching)
  if (env.OAUTH_GOOGLE_ENABLED) {
    const isGoogleFmtValid = Boolean(
      env.GOOGLE_CLIENT_ID?.includes('.apps.googleusercontent.com') && env.GOOGLE_CLIENT_SECRET,
    );
    const callbackPathOk = env.GOOGLE_CALLBACK_URL?.includes('/api/v1/auth/google/callback');
    record({
      name: 'OAuth: Google',
      status: isGoogleFmtValid && callbackPathOk ? 'PASS' : 'FAIL',
      message: `Configured (Client ID, Secret, Callback: ${env.GOOGLE_CALLBACK_URL}).`,
      hint: callbackPathOk
        ? undefined
        : 'GOOGLE_CALLBACK_URL should point to ${API_URL}/api/v1/auth/google/callback',
      required: true,
    });
  } else {
    record({
      name: 'OAuth: Google',
      status: 'SKIP',
      message: 'OAUTH_GOOGLE_ENABLED=false (Disabled).',
      required: false,
    });
  }

  if (env.OAUTH_GITHUB_ENABLED) {
    const isGithubFmtValid = Boolean(
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_CALLBACK_URL,
    );
    const callbackPathOk = env.GITHUB_CALLBACK_URL?.includes('/api/v1/auth/github/callback');
    record({
      name: 'OAuth: GitHub',
      status: isGithubFmtValid && callbackPathOk ? 'PASS' : 'FAIL',
      message: `Configured (Client ID, Secret, Callback: ${env.GITHUB_CALLBACK_URL}).`,
      hint: callbackPathOk
        ? undefined
        : 'GITHUB_CALLBACK_URL should point to ${API_URL}/api/v1/auth/github/callback',
      required: true,
    });
  } else {
    record({
      name: 'OAuth: GitHub',
      status: 'SKIP',
      message: 'OAUTH_GITHUB_ENABLED=false (Disabled).',
      required: false,
    });
  }

  // Check 8: Cloudflare Turnstile
  if (env.TURNSTILE_SECRET_KEY === '1x0000000000000000000000000000000AA') {
    try {
      const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: 'XXXX.DUMMY.TOKEN.XXXX',
        }),
      });
      const data: any = await resp.json();
      record({
        name: 'Cloudflare Turnstile',
        status: data.success ? 'PASS' : 'WARN',
        message: `Dev test token verified with Cloudflare siteverify (success=${data.success}).`,
        required: false,
      });
    } catch (err: any) {
      record({
        name: 'Cloudflare Turnstile',
        status: 'WARN',
        message: `Siteverify probe failed: ${err.message}`,
        required: false,
      });
    }
  } else if (env.TURNSTILE_SECRET_KEY) {
    record({
      name: 'Cloudflare Turnstile',
      status: 'PASS',
      message: 'Custom secret key configured.',
      required: true,
    });
  } else {
    record({
      name: 'Cloudflare Turnstile',
      status: 'SKIP',
      message: 'Not configured.',
      required: false,
    });
  }

  // Check 9: MediaMTX Control API
  try {
    const res = await fetch(`${env.MEDIA_API_URL}/v3/paths/list`, {
      signal: AbortSignal.timeout(2000),
    });
    record({
      name: 'MediaMTX Control API',
      status: res.ok ? 'PASS' : 'WARN',
      message: `Control API reachable on ${env.MEDIA_API_URL} (status ${res.status}).`,
      required: false,
    });
  } catch {
    record({
      name: 'MediaMTX Control API',
      status: 'WARN',
      message: `Cannot reach MediaMTX on ${env.MEDIA_API_URL}.`,
      hint: 'Start mediamtx via docker compose for live video streaming.',
      required: false,
    });
  }

  // Check 10: Coturn STUN/TURN Probe (port 3478)
  const canConnectTurn = await new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.connect(3478, 'localhost', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });

  record({
    name: 'Coturn STUN/TURN',
    status: canConnectTurn ? 'PASS' : 'WARN',
    message: canConnectTurn
      ? 'Port 3478 reachable on localhost.'
      : 'Port 3478 unreachable on localhost.',
    hint: canConnectTurn
      ? undefined
      : 'Start coturn container via docker-compose when WebRTC NAT traversal is needed.',
    required: false,
  });

  // Check 11: MOBILE_BASE_URL HTTPS check
  if (env.MOBILE_BASE_URL) {
    const isHttps = env.MOBILE_BASE_URL.startsWith('https://');
    record({
      name: 'Mobile Streaming URL',
      status: isHttps ? 'PASS' : 'WARN',
      message: `MOBILE_BASE_URL is ${env.MOBILE_BASE_URL}`,
      hint: isHttps
        ? undefined
        : 'Mobile browser camera capture (getUserMedia) requires an HTTPS URL in production or tunnels (e.g. ngrok / cloudflared).',
      required: false,
    });
  } else {
    record({
      name: 'Mobile Streaming URL',
      status: 'SKIP',
      message: 'MOBILE_BASE_URL is omitted (optional in development).',
      required: false,
    });
  }

  // Check 12: CORS Origins Parsing
  const corsOk = env.CORS_ORIGIN.every((origin) => {
    try {
      new URL(origin);
      return true;
    } catch {
      return false;
    }
  });

  record({
    name: 'CORS Origins',
    status: corsOk ? 'PASS' : 'FAIL',
    message: `All ${env.CORS_ORIGIN.length} CORS origin(s) are valid URLs: [${env.CORS_ORIGIN.join(', ')}]`,
    required: true,
  });

  // Check 13: Super Admin & Bootstrap Configuration
  try {
    const conn = await mongoose.createConnection(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    }).asPromise();

    const usersColl = conn.collection('users');
    const superAdminCount = await usersColl.countDocuments({
      role: { $in: ['super_admin', 'Super Admin'] },
      status: 'active',
      active: { $ne: false },
    });

    await conn.close();

    if (env.ADMIN_BOOTSTRAP_ENABLED) {
      const emailDomain = env.ADMIN_EMAIL ? env.ADMIN_EMAIL.split('@')[1] : 'unknown';
      record({
        name: 'Admin Bootstrap Variables',
        status: 'PASS',
        message: `ADMIN_* variables are valid for target domain @${emailDomain}.`,
        required: true,
      });

      if (superAdminCount > 0) {
        record({
          name: 'Super Admin DB State',
          status: 'PASS',
          message: `Active super_admin account verified in database (count: ${superAdminCount}).`,
          required: true,
        });
      } else {
        record({
          name: 'Super Admin DB State',
          status: 'WARN',
          message: 'No active super_admin exists in database yet; will be provisioned on boot.',
          hint: 'Start the NestJS API application to trigger AdminBootstrapService.',
          required: false,
        });
      }
    } else {
      // Bootstrap disabled
      const hasPassword = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
      if (hasPassword) {
        record({
          name: 'Admin Password Hygiene',
          status: 'WARN',
          message: 'ADMIN_PASSWORD is still present in environment while ADMIN_BOOTSTRAP_ENABLED=false.',
          hint: 'For security hygiene, remove ADMIN_PASSWORD from your .env file after initial provisioning.',
          required: false,
        });
      }

      if (superAdminCount > 0) {
        record({
          name: 'Super Admin DB State',
          status: 'PASS',
          message: `Active super_admin account verified in database (count: ${superAdminCount}).`,
          required: true,
        });
      } else {
        record({
          name: 'Super Admin DB State',
          status: 'FAIL',
          message: 'No active super_admin exists in database and ADMIN_BOOTSTRAP_ENABLED=false.',
          hint: 'Run pnpm admin:create to provision an administrator or enable ADMIN_BOOTSTRAP_ENABLED=true.',
          required: true,
        });
      }
    }
  } catch (err: any) {
    record({
      name: 'Super Admin Verification',
      status: 'FAIL',
      message: `Failed to inspect super_admin state: ${err.message}`,
      required: false,
    });
  }

  // Summary
  console.log('\n================================================================');
  console.log('📊 ENVIRONMENT CHECK SUMMARY');
  console.log('================================================================');

  const failedRequired = results.filter((r) => r.status === 'FAIL' && r.required);
  const totalPass = results.filter((r) => r.status === 'PASS').length;
  const totalWarn = results.filter((r) => r.status === 'WARN').length;
  const totalFail = results.filter((r) => r.status === 'FAIL').length;
  const totalSkip = results.filter((r) => r.status === 'SKIP').length;

  console.log(`Results: ${totalPass} PASS | ${totalWarn} WARN | ${totalFail} FAIL | ${totalSkip} SKIP`);

  if (failedRequired.length > 0) {
    console.error(`\n❌ CRITICAL: ${failedRequired.length} required health check(s) failed:`);
    failedRequired.forEach((f) => console.error(`  - ${f.name}: ${f.message}`));
    process.exit(1);
  }

  console.log('\n✅ All critical environment health checks passed successfully.\n');
  process.exit(0);
}

runChecks().catch((err) => {
  console.error('Unexpected check runner failure:', err);
  process.exit(1);
});
