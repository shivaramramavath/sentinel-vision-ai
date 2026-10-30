const fs = require('fs');

let file = 'apps/api/src/cameras/cameras.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/@Roles\('Super Admin', 'Investigator'\)/g, "@RequirePermissions('cameras:manage')");
content = content.replace(/@Roles\('Super Admin', 'super_admin'\)/g, "@RequirePermissions('topology:edit')");
content = content.replace(/@Roles\('Super Admin'\)/g, "@RequirePermissions('cameras:manage')");

// Fix specific purgeRetention endpoint to retention:manage
content = content.replace(
  "@RequirePermissions('cameras:manage')\n  @ApiBearerAuth()\n  @ApiOperation({ summary: 'Trigger automated data retention purge (deletes expired segments & vectors)' })",
  "@RequirePermissions('retention:manage')\n  @ApiBearerAuth()\n  @ApiOperation({ summary: 'Trigger automated data retention purge (deletes expired segments & vectors)' })"
);

// Fix topology put endpoint to topology:edit
content = content.replace(
  "@Put('topology/:from/:to')\n  @UseGuards(JwtAuthGuard, PermissionsGuard)\n  @RequirePermissions('cameras:manage')",
  "@Put('topology/:from/:to')\n  @UseGuards(JwtAuthGuard, PermissionsGuard)\n  @RequirePermissions('topology:edit')"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed cameras.controller.ts');
