import * as fs from 'fs';
import * as path from 'path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  AlertsCreatedPayloadSchema,
  CandidatesScoredPayloadSchema,
  DeadLetterQueuePayloadSchema,
  DetectionsPersonPayloadSchema,
  EmbeddingsGeneratedPayloadSchema,
  EventEnvelopeSchema,
  JourneysUpdatedPayloadSchema,
  SearchJobsCommandPayloadSchema,
  SearchJobsProgressPayloadSchema,
  SightingsCreatedPayloadSchema,
  VideoFramesRawPayloadSchema,
} from './events/index';
import {
  CreateCaseSchema,
  UpdateCaseSchema,
  CaseSchema,
} from './schemas/case.schema';
import {
  CreateCameraSchema,
  UpdateCameraSchema,
  CameraSchema,
} from './schemas/camera.schema';

const allSchemas: Record<string, any> = {
  EventEnvelope: EventEnvelopeSchema,
  SearchJobsCommandPayload: SearchJobsCommandPayloadSchema,
  SearchJobsProgressPayload: SearchJobsProgressPayloadSchema,
  VideoFramesRawPayload: VideoFramesRawPayloadSchema,
  DetectionsPersonPayload: DetectionsPersonPayloadSchema,
  EmbeddingsGeneratedPayload: EmbeddingsGeneratedPayloadSchema,
  CandidatesScoredPayload: CandidatesScoredPayloadSchema,
  SightingsCreatedPayload: SightingsCreatedPayloadSchema,
  JourneysUpdatedPayload: JourneysUpdatedPayloadSchema,
  AlertsCreatedPayload: AlertsCreatedPayloadSchema,
  DeadLetterQueuePayload: DeadLetterQueuePayloadSchema,
  CreateCaseDto: CreateCaseSchema,
  UpdateCaseDto: UpdateCaseSchema,
  Case: CaseSchema,
  CreateCameraDto: CreateCameraSchema,
  UpdateCameraDto: UpdateCameraSchema,
  Camera: CameraSchema,
};

const outputDir = path.resolve(__dirname, '../../generated-json-schema');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

for (const [name, schema] of Object.entries(allSchemas)) {
  const jsonSchema = zodToJsonSchema(schema as any, name);
  const filePath = path.join(outputDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(jsonSchema, null, 2), 'utf8');
}

// Also write a consolidated schema
const consolidated = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'SentinelVisionContracts',
  definitions: Object.fromEntries(
    Object.entries(allSchemas).map(([name, schema]) => [
      name,
      zodToJsonSchema(schema as any, name),
    ]),
  ),
};
fs.writeFileSync(
  path.join(outputDir, 'contracts.json'),
  JSON.stringify(consolidated, null, 2),
  'utf8',
);

console.log(`Exported JSON Schemas for ${Object.keys(allSchemas).length} models to ${outputDir}`);
