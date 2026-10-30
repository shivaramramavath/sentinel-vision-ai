import { registerAs } from '@nestjs/config';

export const pineconeConfig = registerAs('pinecone', () => ({
  apiKey: process.env.PINECONE_API_KEY ?? '',
  cloud: (process.env.PINECONE_CLOUD ?? 'aws') as 'aws' | 'gcp' | 'azure',
  region: process.env.PINECONE_REGION ?? 'us-east-1',
  indexFace: process.env.PINECONE_INDEX_FACE ?? 'sentinel-face',
  indexReid: process.env.PINECONE_INDEX_REID ?? 'sentinel-reid',
  faceDim: parseInt(process.env.PINECONE_FACE_DIM ?? '512', 10),
  reidDim: parseInt(process.env.PINECONE_REID_DIM ?? '512', 10),
  metric: (process.env.PINECONE_METRIC ?? 'cosine') as 'cosine' | 'dotproduct' | 'euclidean',
  namespacePrefix: process.env.PINECONE_NAMESPACE_PREFIX ?? 'dev',
}));
