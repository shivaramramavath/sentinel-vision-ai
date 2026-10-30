import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pinecone, ServerlessSpecCloudEnum } from '@pinecone-database/pinecone';

// Load environment from apps/api/.env or root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) {
  console.error('FAIL: PINECONE_API_KEY environment variable is missing.');
  process.exit(1);
}

const faceIndexName = process.env.PINECONE_INDEX_FACE || 'face-embeddings';
const reidIndexName = process.env.PINECONE_INDEX_REID || 'reid-embeddings';
const faceDim = parseInt(process.env.PINECONE_FACE_DIM || '512', 10);
const reidDim = parseInt(process.env.PINECONE_REID_DIM || '512', 10);
const cloud = (process.env.PINECONE_CLOUD || 'aws') as ServerlessSpecCloudEnum;
const region = process.env.PINECONE_REGION || 'us-east-1';

if (faceDim !== 512 || reidDim !== 512) {
  console.error(
    `FAIL: Dimension validation failed. Neural model registry strictly requires 512 for face and 512 for Re-ID. Configured: face=${faceDim}, reid=${reidDim}`,
  );
  process.exit(1);
}

const pc = new Pinecone({ apiKey });

async function syncIndex(name: string, expectedDim: number) {
  console.log(`Checking Pinecone index: "${name}"...`);
  const response = await pc.listIndexes();
  const indexes = response.indexes || [];
  const existing = indexes.find((i) => i.name === name);

  if (!existing) {
    console.log(`Index "${name}" does not exist. Creating serverless index (${expectedDim}-dim, cosine, ${cloud}/${region})...`);
    await pc.createIndex({
      name,
      dimension: expectedDim,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud,
          region,
        },
      },
    });
    console.log(`PASS: Index "${name}" created successfully.`);
    return;
  }

  // If exists, validate dimension and metric
  console.log(`Index "${name}" exists. Validating schema...`);
  const desc = await pc.describeIndex(name);
  if (desc.dimension !== expectedDim) {
    console.error(
      `FATAL: Index "${name}" has dimension ${desc.dimension}, but model registry requires ${expectedDim}! Metric: ${desc.metric}`,
    );
    process.exit(1);
  }
  if (desc.metric !== 'cosine') {
    console.error(
      `FATAL: Index "${name}" uses metric "${desc.metric}", but cosine distance is strictly required!`,
    );
    process.exit(1);
  }

  console.log(`PASS: Index "${name}" matches requirements (${desc.dimension}d, ${desc.metric}, ${desc.status?.state || 'ready'}).`);
}

async function main() {
  try {
    console.log('--- Initializing Pinecone Vector Indexes ---');
    await syncIndex(faceIndexName, faceDim);
    await syncIndex(reidIndexName, reidDim);
    console.log('--- All Pinecone Indexes Verified Successfully ---');
  } catch (err: any) {
    console.error('FAIL: Pinecone initialization failed:', err.message);
    process.exit(1);
  }
}

main();
