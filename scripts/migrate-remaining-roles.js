const fs = require('fs');

function replaceInFile(file, replacements) {
  if (!fs.existsSync(file)) {
    console.warn('File not found:', file);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  for (const { from, to } of replacements) {
    if (typeof from === 'string') {
      content = content.split(from).join(to);
    } else {
      content = content.replace(from, to);
    }
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log('Processed', file);
}

// 1. cases.controller.ts
replaceInFile('apps/api/src/cases/cases.controller.ts', [
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Create new missing person case' })", to: "@RequirePermissions('cases:create')\n  @ApiOperation({ summary: 'Create new missing person case' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @UseGuards(CaseAccessGuard)\n  @ApiOperation({ summary: 'Update case status' })", to: "@RequirePermissions('cases:update')\n  @UseGuards(CaseAccessGuard)\n  @ApiOperation({ summary: 'Update case status' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @UseGuards(CaseAccessGuard)\n  @ApiOperation({ summary: 'Execute case-closure workflow, lock evidence, and log final archival audit' })", to: "@RequirePermissions('cases:close')\n  @UseGuards(CaseAccessGuard)\n  @ApiOperation({ summary: 'Execute case-closure workflow, lock evidence, and log final archival audit' })" },
  { from: "@Get()\n  @ApiOperation({ summary: 'List cases with filtering and pagination' })", to: "@Get()\n  @RequirePermissions('cases:read')\n  @ApiOperation({ summary: 'List cases with filtering and pagination' })" },
  { from: "@Get(':id')\n  @ApiOperation({ summary: 'Get case by ID with access-controlled PII' })", to: "@Get(':id')\n  @RequirePermissions('cases:read')\n  @ApiOperation({ summary: 'Get case by ID with access-controlled PII' })" }
]);

// 2. evidence.controller.ts
replaceInFile('apps/api/src/evidence/evidence.controller.ts', [
  { from: "@Roles('Super Admin', 'Investigator', 'Reviewer')", to: "@RequirePermissions('evidence:read')" },
  { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('evidence:export')" },
  { from: "@Get()\n  @ApiOperation({ summary: 'List evidence items with filtering and pagination' })", to: "@Get()\n  @RequirePermissions('evidence:read')\n  @ApiOperation({ summary: 'List evidence items with filtering and pagination' })" }
]);

// 3. reports.controller.ts
replaceInFile('apps/api/src/reports/reports.controller.ts', [
  { from: "@Roles('Super Admin', 'Investigator', 'Reviewer', 'Viewer')", to: "@RequirePermissions('reports:read')" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Generate a new report' })", to: "@RequirePermissions('reports:generate')\n  @ApiOperation({ summary: 'Generate a new report' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Approve a generated report' })", to: "@RequirePermissions('reports:approve')\n  @ApiOperation({ summary: 'Approve a generated report' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Export report as PDF' })", to: "@RequirePermissions('reports:read')\n  @ApiOperation({ summary: 'Export report as PDF' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Share report with external agency' })", to: "@RequirePermissions('reports:generate')\n  @ApiOperation({ summary: 'Share report with external agency' })" }
]);

// 4. search-jobs.controller.ts
replaceInFile('apps/api/src/search-jobs/search-jobs.controller.ts', [
  { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('searches:run')" },
  { from: "@Get()\n  @ApiOperation({ summary: 'List search jobs with status and progress' })", to: "@Get()\n  @RequirePermissions('cases:read')\n  @ApiOperation({ summary: 'List search jobs with status and progress' })" }
]);

// 5. sightings.controller.ts
replaceInFile('apps/api/src/sightings/sightings.controller.ts', [
  { from: "@Roles('Super Admin', 'Investigator', 'Reviewer', 'super_admin', 'investigator', 'reviewer')", to: "@RequirePermissions('sightings:decide')" },
  { from: "@Roles('Super Admin', 'Investigator', 'Reviewer')", to: "@RequirePermissions('sightings:decide')" },
  { from: "@Get()\n  @ApiOperation({ summary: 'List sightings with filtering and pagination' })", to: "@Get()\n  @RequirePermissions('sightings:read')\n  @ApiOperation({ summary: 'List sightings with filtering and pagination' })" }
]);

// 6. verification.controller.ts
replaceInFile('apps/api/src/verification/verification.controller.ts', [
  { from: "@Roles('Investigator', 'Reviewer', 'Super Admin')\n  @ApiOperation({ summary: 'Get prioritized candidate queue for human adjudication' })", to: "@RequirePermissions('sightings:read')\n  @ApiOperation({ summary: 'Get prioritized candidate queue for human adjudication' })" },
  { from: "@Roles('Investigator', 'Reviewer', 'Super Admin')", to: "@RequirePermissions('sightings:decide')" },
  { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('sightings:decide')" }
]);

// 7. cameras.controller.ts
replaceInFile('apps/api/src/cameras/cameras.controller.ts', [
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Create a new camera stream' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Create a new camera stream' })" },
  { from: "@Roles('Super Admin')\n  @ApiOperation({ summary: 'Permanently remove camera configuration' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Permanently remove camera configuration' })" },
  { from: "@Roles('Super Admin', 'super_admin')\n  @ApiOperation({ summary: 'Regenerate camera credentials' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Regenerate camera credentials' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Create or update camera topology transition' })", to: "@RequirePermissions('topology:edit')\n  @ApiOperation({ summary: 'Create or update camera topology transition' })" },
  { from: "@Roles('Super Admin')\n  @ApiOperation({ summary: 'Delete camera topology transition' })", to: "@RequirePermissions('topology:edit')\n  @ApiOperation({ summary: 'Delete camera topology transition' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Export full camera network graph as JSON' })", to: "@RequirePermissions('cameras:read')\n  @ApiOperation({ summary: 'Export full camera network graph as JSON' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Import camera network topology topology JSON' })", to: "@RequirePermissions('topology:edit')\n  @ApiOperation({ summary: 'Import camera network topology topology JSON' })" },
  { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Update camera settings' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Update camera settings' })" },
  { from: "@Roles('Super Admin')\n  @ApiOperation({ summary: 'Delete camera stream' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Delete camera stream' })" },
  { from: "@Get()\n  @ApiOperation({ summary: 'List all camera feeds with telemetry' })", to: "@Get()\n  @RequirePermissions('cameras:read')\n  @ApiOperation({ summary: 'List all camera feeds with telemetry' })" }
]);
