/**
 * Script to create Pinecone indexes for Sentinel Vision AI.
 * Run once: `ts-node infra/scripts/setup-pinecone.ts`
 *
 * IMPORTANT: face and reid indexes are SEPARATE.
 * face-embeddings: 512-dim cosine (ArcFace)
 * reid-embeddings: 256-dim cosine (OSNet)
 */
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY ?? '',
});

async function run() {
  const existing = await pc.listIndexes();
  const existingNames = existing.indexes?.map((i) => i.name) ?? [];

  // Face embeddings index — ArcFace 512-dim
  if (!existingNames.includes('face-embeddings')) {
    console.log('Creating face-embeddings index (512-dim, cosine)…');
    await pc.createIndex({
      name: 'face-embeddings',
      dimension: 512,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
    });
    console.log('face-embeddings created');
  } else {
    console.log('face-embeddings already exists');
  }

  // Re-ID embeddings index — OSNet 256-dim
  if (!existingNames.includes('reid-embeddings')) {
    console.log('Creating reid-embeddings index (256-dim, cosine)…');
    await pc.createIndex({
      name: 'reid-embeddings',
      dimension: 256,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
    });
    console.log('reid-embeddings created');
  } else {
    console.log('reid-embeddings already exists');
  }

  console.log('Pinecone setup complete');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
