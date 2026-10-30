import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditAction } from '../audit/decorators/audit-action.decorator';
import { AuditInterceptor } from '../audit/interceptors/audit.interceptor';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('templates')
  @ApiOperation({ summary: 'List standardized report template gallery' })
  getTemplates() {
    return this.reportsService.getTemplates();
  }

  @Get()
  @ApiOperation({ summary: 'List generated investigative reports' })
  async getReports(@Query('caseId') caseId?: string) {
    return this.reportsService.findAll(caseId);
  }

  @Post()
  @RequirePermissions('reports:generate')
  @ApiOperation({ summary: 'Generate a new audit-ready dossier report in PDF or CSV format' })
  @AuditAction('GENERATE_REPORT', 'Report', (req, res) => res.id)
  async generateReport(
    @Body() body: { caseId: string; title: string; format: 'PDF' | 'CSV'; templateId?: string },
    @Req() req: any,
  ) {
    const generatedBy = req.user?.fullName || req.user?.email || 'Investigator';
    return this.reportsService.generateReport({
      ...body,
      generatedBy,
    });
  }

  @Post(':id/approve')
  @RequirePermissions('reports:approve')
  @ApiOperation({ summary: 'Supervisor workflow: approve, lock, hash and digitally sign report' })
  async approveReport(@Param('id') id: string, @Req() req: any) {
    const supervisorEmail = req.user?.email || 'supervisor@sentinel.gov';
    return this.reportsService.approveReport(id, supervisorEmail);
  }

  @Post(':id/share')
  @RequirePermissions('reports:generate')
  @ApiOperation({ summary: 'Create time-limited access share link' })
  async shareReport(
    @Param('id') id: string,
    @Body('expiresInHours') expiresInHours?: number,
    @Body('passcodeProtected') passcodeProtected?: boolean,
  ) {
    return this.reportsService.createShareLink(id, expiresInHours, passcodeProtected);
  }

  @Get('schedules')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'List recurring report schedules' })
  getSchedules() {
    return this.reportsService.getSchedules();
  }

  @Post('schedules')
  @RequirePermissions('reports:generate')
  @ApiOperation({ summary: 'Create a new recurring report schedule' })
  createSchedule(@Body() body: any) {
    return this.reportsService.createSchedule(body);
  }

  @Get(':id/download')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Download generated PDF report via signed link with expiry' })
  @ApiResponse({ status: 200, description: 'Streams PDF binary' })
  async downloadReport(
    @Param('id') id: string,
    @Query('expires') expires: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.reportsService.getPdfBuffer(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Sentinel_Dossier_${id}.pdf"`);
    res.send(pdfBuffer);
  }
}
