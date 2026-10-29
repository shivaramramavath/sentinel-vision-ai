// MongoDB initialisation script — creates collections with basic indexes
db = db.getSiblingDB('sentinel_vision');

db.createCollection('cases');
db.createCollection('cameras');
db.createCollection('embeddings');
db.createCollection('sightings');
db.createCollection('alerts');
db.createCollection('users');

// Cases
db.cases.createIndex({ status: 1 });
db.cases.createIndex({ createdAt: -1 });
db.cases.createIndex({ 'personDescription.lastSeenAt': -1 });

// Cameras
db.cameras.createIndex({ status: 1 });

// Embeddings
db.embeddings.createIndex({ kind: 1, caseId: 1 });
db.embeddings.createIndex({ cameraId: 1, frameTimestamp: -1 });
db.embeddings.createIndex({ pineconeId: 1 }, { unique: true });

// Sightings
db.sightings.createIndex({ caseId: 1, status: 1 });
db.sightings.createIndex({ cameraId: 1, detectedAt: -1 });
db.sightings.createIndex({ status: 1, createdAt: -1 });

// Alerts
db.alerts.createIndex({ caseId: 1 });
db.alerts.createIndex({ status: 1 });

print('Sentinel Vision DB initialised');
