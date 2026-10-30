const fs = require('fs');

const mappings = [
  // alerts.controller.ts
  {
    file: 'apps/api/src/alerts/alerts.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('alerts:act')" },
      { from: "@Roles('Super Admin')", to: "@RequirePermissions('alerts:manage_rules')" },
    ]
  },
  // audit.controller.ts
  {
    file: 'apps/api/src/audit/audit.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('audit:read')" }
    ]
  },
  // dashboard.controller.ts
  {
    file: 'apps/api/src/dashboard/dashboard.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('dashboard:read')" }
    ]
  },
  // cases.controller.ts
  {
    file: 'apps/api/src/cases/cases.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';\nimport { UseInterceptors } from '@nestjs/common';\nimport { RbacDataShapingInterceptor } from '../rbac/interceptors/rbac-data-shaping.interceptor';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)\n@UseInterceptors(RbacDataShapingInterceptor)" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Create a new case' })", to: "@RequirePermissions('cases:create')\n  @ApiOperation({ summary: 'Create a new case' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Update case metadata' })", to: "@RequirePermissions('cases:update')\n  @ApiOperation({ summary: 'Update case metadata' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Assign case to investigator' })", to: "@RequirePermissions('cases:assign')\n  @ApiOperation({ summary: 'Assign case to investigator' })" }
    ]
  },
  // sightings.controller.ts
  {
    file: 'apps/api/src/sightings/sightings.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';\nimport { UseInterceptors } from '@nestjs/common';\nimport { RbacDataShapingInterceptor } from '../rbac/interceptors/rbac-data-shaping.interceptor';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)\n@UseInterceptors(RbacDataShapingInterceptor)" },
      { from: "@Roles('Super Admin', 'Investigator', 'Reviewer', 'super_admin', 'investigator', 'reviewer')\n  @ApiOperation({ summary: 'Decide on a sighting (confirm / reject)' })", to: "@RequirePermissions('sightings:decide')\n  @ApiOperation({ summary: 'Decide on a sighting (confirm / reject)' })" },
      { from: "@Roles('Super Admin', 'Investigator', 'Reviewer', 'super_admin', 'investigator', 'reviewer')\n  @ApiOperation({ summary: 'Adjudicate sighting (alias for decide)' })", to: "@RequirePermissions('sightings:decide')\n  @ApiOperation({ summary: 'Adjudicate sighting (alias for decide)' })" },
      { from: "@Roles('Super Admin', 'Investigator', 'Reviewer')\n  @ApiOperation({ summary: 'Bulk decide on multiple sightings' })", to: "@RequirePermissions('sightings:decide')\n  @ApiOperation({ summary: 'Bulk decide on multiple sightings' })" }
    ]
  },
  // evidence.controller.ts
  {
    file: 'apps/api/src/evidence/evidence.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator', 'Reviewer')\n  @ApiOperation({ summary: 'Add an evidence package item' })", to: "@RequirePermissions('evidence:read')\n  @ApiOperation({ summary: 'Add an evidence package item' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Export evidence packet as signed ZIP with chain-of-custody ledger' })", to: "@RequirePermissions('evidence:export')\n  @ApiOperation({ summary: 'Export evidence packet as signed ZIP with chain-of-custody ledger' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Apply redaction' })", to: "@RequirePermissions('evidence:redact')\n  @ApiOperation({ summary: 'Apply redaction' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Toggle legal hold' })", to: "@RequirePermissions('evidence:legal_hold')\n  @ApiOperation({ summary: 'Toggle legal hold' })" },
      { from: "@Roles('Super Admin', 'Investigator', 'Reviewer')\n  @ApiOperation({ summary: 'Verify evidence chain integrity' })", to: "@RequirePermissions('evidence:verify')\n  @ApiOperation({ summary: 'Verify evidence chain integrity' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Generate court-ready packet' })", to: "@RequirePermissions('evidence:export')\n  @ApiOperation({ summary: 'Generate court-ready packet' })" }
    ]
  },
  // reports.controller.ts
  {
    file: 'apps/api/src/reports/reports.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Generate a new report' })", to: "@RequirePermissions('reports:generate')\n  @ApiOperation({ summary: 'Generate a new report' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Approve a generated report' })", to: "@RequirePermissions('reports:approve')\n  @ApiOperation({ summary: 'Approve a generated report' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Export report as PDF' })", to: "@RequirePermissions('reports:read')\n  @ApiOperation({ summary: 'Export report as PDF' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Share report with external agency' })", to: "@RequirePermissions('reports:generate')\n  @ApiOperation({ summary: 'Share report with external agency' })" },
      { from: "@Roles('Super Admin', 'Investigator', 'Reviewer', 'Viewer')\n  @ApiOperation({ summary: 'List generated reports' })", to: "@RequirePermissions('reports:read')\n  @ApiOperation({ summary: 'List generated reports' })" }
    ]
  },
  // search-jobs.controller.ts
  {
    file: 'apps/api/src/search-jobs/search-jobs.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @UseGuards(RateLimitGuard)\n  @ApiOperation({ summary: 'Trigger a new batch / real-time search job' })", to: "@RequirePermissions('searches:run')\n  @UseGuards(RateLimitGuard)\n  @ApiOperation({ summary: 'Trigger a new batch / real-time search job' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Pause a running search job' })", to: "@RequirePermissions('searches:cancel')\n  @ApiOperation({ summary: 'Pause a running search job' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Resume a paused search job' })", to: "@RequirePermissions('searches:run')\n  @ApiOperation({ summary: 'Resume a paused search job' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Cancel an active search job' })", to: "@RequirePermissions('searches:cancel')\n  @ApiOperation({ summary: 'Cancel an active search job' })" }
    ]
  },
  // references.controller.ts
  {
    file: 'apps/api/src/references/references.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('references:manage')" }
    ]
  },
  // missing-persons.controller.ts
  {
    file: 'apps/api/src/missing-persons/missing-persons.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';\nimport { UseInterceptors } from '@nestjs/common';\nimport { RbacDataShapingInterceptor } from '../rbac/interceptors/rbac-data-shaping.interceptor';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)\n@UseInterceptors(RbacDataShapingInterceptor)" },
      { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('cases:update')" }
    ]
  },
  // cameras.controller.ts
  {
    file: 'apps/api/src/cameras/cameras.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Create a new camera stream' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Create a new camera stream' })" },
      { from: "@Roles('Super Admin')\n  @ApiOperation({ summary: 'Permanently remove camera configuration' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Permanently remove camera configuration' })" },
      { from: "@Roles('Super Admin', 'super_admin')\n  @ApiOperation({ summary: 'Regenerate camera credentials' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Regenerate camera credentials' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Create or update camera topology transition' })", to: "@RequirePermissions('topology:edit')\n  @ApiOperation({ summary: 'Create or update camera topology transition' })" },
      { from: "@Roles('Super Admin')\n  @ApiOperation({ summary: 'Delete camera topology transition' })", to: "@RequirePermissions('topology:edit')\n  @ApiOperation({ summary: 'Delete camera topology transition' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Export full camera network graph as JSON' })", to: "@RequirePermissions('cameras:read')\n  @ApiOperation({ summary: 'Export full camera network graph as JSON' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Import camera network topology topology JSON' })", to: "@RequirePermissions('topology:edit')\n  @ApiOperation({ summary: 'Import camera network topology topology JSON' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Update camera settings' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Update camera settings' })" },
      { from: "@Roles('Super Admin')\n  @ApiOperation({ summary: 'Delete camera stream' })", to: "@RequirePermissions('cameras:manage')\n  @ApiOperation({ summary: 'Delete camera stream' })" }
    ]
  },
  // users.controller.ts
  {
    file: 'apps/api/src/users/users.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Super Admin', 'Investigator')", to: "@RequirePermissions('users:read')" }
    ]
  },
  // verification.controller.ts
  {
    file: 'apps/api/src/verification/verification.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('Investigator', 'Reviewer', 'Super Admin')\n  @ApiOperation({ summary: 'Get prioritized candidate queue for human adjudication' })", to: "@RequirePermissions('sightings:read')\n  @ApiOperation({ summary: 'Get prioritized candidate queue for human adjudication' })" },
      { from: "@Roles('Investigator', 'Reviewer', 'Super Admin')\n  @ApiOperation({ summary: 'Record verification decision' })", to: "@RequirePermissions('sightings:decide')\n  @ApiOperation({ summary: 'Record verification decision' })" },
      { from: "@Roles('Investigator', 'Reviewer', 'Super Admin')\n  @ApiOperation({ summary: 'Record quick verification action' })", to: "@RequirePermissions('sightings:decide')\n  @ApiOperation({ summary: 'Record quick verification action' })" },
      { from: "@Roles('Investigator', 'Reviewer', 'Super Admin')\n  @ApiOperation({ summary: 'Request second opinion on verification' })", to: "@RequirePermissions('sightings:decide')\n  @ApiOperation({ summary: 'Request second opinion on verification' })" },
      { from: "@Roles('Super Admin', 'Investigator')\n  @ApiOperation({ summary: 'Batch accept all candidate matches above high confidence threshold' })", to: "@RequirePermissions('sightings:decide')\n  @ApiOperation({ summary: 'Batch accept all candidate matches above high confidence threshold' })" }
    ]
  },
  // journeys.controller.ts
  {
    file: 'apps/api/src/journeys/journeys.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../auth/guards/roles.guard';\nimport { Roles } from '../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../common/decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Get(':caseId')\n  @ApiOperation({ summary: 'Get journey timeline and camera graph for case' })", to: "@Get(':caseId')\n  @RequirePermissions('journeys:read')\n  @ApiOperation({ summary: 'Get journey timeline and camera graph for case' })" }
    ]
  },
  // storage.controller.ts
  {
    file: 'apps/api/src/common/storage/storage.controller.ts',
    replaces: [
      { from: "import { RolesGuard } from '../../auth/guards/roles.guard';\nimport { Roles } from '../../auth/decorators/roles.decorator';", to: "import { PermissionsGuard } from '../../rbac/guards/permissions.guard';\nimport { RequirePermissions } from '../decorators/require-permissions.decorator';" },
      { from: "@UseGuards(JwtAuthGuard, RolesGuard)", to: "@UseGuards(JwtAuthGuard, PermissionsGuard)" },
      { from: "@Roles('super_admin', 'Super Admin')", to: "@RequirePermissions('admin:system')" }
    ]
  }
];

for (const m of mappings) {
  if (fs.existsSync(m.file)) {
    let content = fs.readFileSync(m.file, 'utf8');
    for (const r of m.replaces) {
      if (content.includes(r.from)) {
        content = content.replace(new RegExp(r.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), r.to);
      }
    }
    fs.writeFileSync(m.file, content, 'utf8');
    console.log('Migrated', m.file);
  } else {
    console.warn('File not found:', m.file);
  }
}
