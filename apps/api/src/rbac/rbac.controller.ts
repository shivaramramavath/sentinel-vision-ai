import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RequireStepUp } from '../common/decorators/require-step-up.decorator';
import { RbacService } from './rbac.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('RBAC & Role Management')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('rbac/roles')
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'List all available roles and their metadata' })
  getRoles() {
    return this.rbacService.getRolesMeta();
  }

  @Get('rbac/matrix')
  @RequirePermissions('roles:read')
  @ApiOperation({ summary: 'Get full role-permission mapping matrix' })
  getMatrix() {
    return this.rbacService.getRoleMatrix();
  }

  @Put('admin/users/:id/role')
  @RequirePermissions('roles:manage')
  @RequireStepUp()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Update a user's role. Requires step-up and 4-eyes approval when promoting to super_admin.",
  })
  async updateUserRole(
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: any,
  ) {
    const actor = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    };

    return this.rbacService.assignUserRole(
      actor,
      targetUserId,
      dto.role,
      dto.reason,
      dto.fourEyesApproverId,
    );
  }
}
