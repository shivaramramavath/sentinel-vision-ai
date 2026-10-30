import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { ReviewSightingDto } from '../sightings/dto/review-sighting.dto';

@ApiTags('verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('queue')
  @RequirePermissions('sightings:decide')
  @ApiOperation({ summary: 'Get prioritized verification queue (sorted by case priority & calibrated score)' })
  @ApiResponse({ status: 200, description: 'Prioritized list of candidate sightings awaiting review' })
  async getQueue(@Query('limit') limit?: number): Promise<any[]> {
    return this.verificationService.getPrioritizedQueue(limit ? Number(limit) : 50);
  }

  @Post(':id/lock')
  @RequirePermissions('sightings:decide')
  @ApiOperation({ summary: 'Acquire exclusive reviewer lock on a sighting to prevent concurrent double-review' })
  @ApiResponse({ status: 200, description: 'Lock acquired' })
  @ApiResponse({ status: 409, description: 'Sighting is currently locked by another reviewer' })
  async acquireLock(@Param('id') sightingId: string, @Request() req: any) {
    const reviewerId = req.user?.id || 'reviewer_001';
    const reviewerEmail = req.user?.email || 'reviewer@sentinel.local';
    return this.verificationService.acquireLock(sightingId, reviewerId, reviewerEmail);
  }

  @Post(':id/unlock')
  @RequirePermissions('sightings:decide')
  @ApiOperation({ summary: 'Release reviewer lock when navigating away or cancelling' })
  @ApiResponse({ status: 200, description: 'Lock released' })
  async releaseLock(@Param('id') sightingId: string, @Request() req: any) {
    const reviewerEmail = req.user?.email || 'reviewer@sentinel.local';
    return this.verificationService.releaseLock(sightingId, reviewerEmail);
  }

  @Post(':id/review')
  @RequirePermissions('sightings:decide')
  @ApiOperation({
    summary: 'Submit human verification decision (two-person rule enforced on high-priority cases)',
  })
  @ApiResponse({ status: 200, description: 'Sighting verified and training label recorded' })
  @ApiResponse({ status: 400, description: 'Validation or two-person rule violation' })
  async review(
    @Param('id') sightingId: string,
    @Body() dto: ReviewSightingDto,
    @Request() req: any,
  ) {
    const reviewerId = req.user?.id || 'reviewer_001';
    const reviewerEmail = req.user?.email || 'reviewer@sentinel.local';
    return this.verificationService.verifySighting(sightingId, dto, reviewerId, reviewerEmail);
  }

  @Get('labels')
  @RequirePermissions('sightings:decide')
  @ApiOperation({ summary: 'Export human verification training labels for model calibration' })
  @ApiResponse({ status: 200, description: 'Array of verified labels' })
  async getLabels(@Query('limit') limit?: number) {
    return this.verificationService.getLabels(limit ? Number(limit) : 1000);
  }
}
