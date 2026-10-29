import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('Super Admin', 'Investigator')
  @ApiOperation({ summary: 'Get immutable audit logs' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getLogs(@Query('limit') limit = 100) {
    return this.auditService.getRecentLogs(Number(limit) || 100);
  }
}
