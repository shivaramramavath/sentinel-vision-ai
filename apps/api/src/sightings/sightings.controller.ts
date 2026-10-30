import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SightingsService } from './sightings.service';
import { ReviewSightingDto } from './dto/review-sighting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RbacDataShapingInterceptor } from '../rbac/interceptors/rbac-data-shaping.interceptor';
import { AuditAction } from '../audit/decorators/audit-action.decorator';
import { AuditInterceptor } from '../audit/interceptors/audit.interceptor';

@ApiTags('Sightings')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(RbacDataShapingInterceptor)
@UseInterceptors(AuditInterceptor)
export class SightingsController {
  constructor(private readonly sightingsService: SightingsService) {}

  @Get('sightings')
  @ApiOperation({ summary: 'List sightings with optional cursor-based pagination' })
  @ApiQuery({ name: 'caseId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getSightings(
    @Query('caseId') caseId?: string,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    if (cursor || limit) {
      return this.sightingsService.findPaginated({
        caseId,
        status,
        cursor,
        limit: limit ? Number(limit) : 20,
      });
    }
    return this.sightingsService.findAll(caseId);
  }

  @Get('cases/:caseId/sightings')
  @ApiOperation({ summary: 'Get all possible sightings for a specific case' })
  async getSightingsForCase(@Param('caseId') caseId: string) {
    return this.sightingsService.findAll(caseId);
  }

  @Get('sightings/hard-negatives')
  @ApiOperation({ summary: 'Get hard negatives suppression list' })
  @ApiQuery({ name: 'caseId', required: true })
  async getHardNegativesQuery(@Query('caseId') caseId: string) {
    return this.sightingsService.getHardNegatives(caseId);
  }

  @Get('cases/:caseId/hard-negatives')
  @ApiOperation({ summary: 'Get hard negatives suppression list for a specific case' })
  async getHardNegativesForCase(@Param('caseId') caseId: string) {
    return this.sightingsService.getHardNegatives(caseId);
  }

  @Get('sightings/:id')
  @ApiOperation({ summary: 'Get sighting details by ID' })
  async getSighting(@Param('id') id: string) {
    return this.sightingsService.findById(id);
  }

  @Patch('sightings/:id/review')
  @RequirePermissions('sightings:decide')
  @ApiOperation({ summary: 'Human verification decision on possible sighting match' })
  @AuditAction('REVIEW_SIGHTING', 'Sighting', (req) => req.params.id)
  async reviewSighting(
    @Param('id') id: string,
    @Body() dto: ReviewSightingDto,
    @Req() req: any,
  ) {
    const reviewerName = req.user?.fullName || req.user?.email || 'Officer';
    return this.sightingsService.review(id, dto.status, dto.notes, reviewerName, dto.rejectReasonCode);
  }

  @Post('sightings/:id/decision')
  @RequirePermissions('sightings:decide')
  @ApiOperation({ summary: 'Submit operator sighting verification decision' })
  @AuditAction('REVIEW_SIGHTING', 'Sighting', (req) => req.params.id)
  async submitDecision(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const reviewerName = req.user?.fullName || req.user?.email || 'Officer';
    const status = body.decision || body.status || 'confirmed';
    const notes = body.note || body.notes || '';
    const rejectReasonCode = body.reasonCode || body.rejectReasonCode;
    return this.sightingsService.review(id, status, notes, reviewerName, rejectReasonCode);
  }

  @Post('sightings/:id/promote-to-reference')
  @RequirePermissions('sightings:decide')
  @ApiOperation({ summary: 'Promote verified sighting crop to reference (type cctv_crop_verified, dual approver for high priority)' })
  @AuditAction('PROMOTE_SIGHTING_TO_REFERENCE', 'Sighting', (req) => req.params.id)
  async promoteToReference(
    @Param('id') id: string,
    @Body('notes') notes: string,
    @Req() req: any,
  ) {
    const actor = req.user?.fullName || req.user?.email || 'Officer';
    return this.sightingsService.promoteToReference(id, actor, notes);
  }
}
