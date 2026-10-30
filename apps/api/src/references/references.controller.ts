import {
  Controller,
  Post,
  Delete,
  Patch,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ReferencesService } from './references.service';
import {
  PresignReferenceUploadDto,
  RegisterReferenceDto,
  PatchReferenceDto,
  ReprocessReferenceDto,
} from './dto/references.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CaseAccessGuard } from '../auth/guards/case-access.guard';
import { AuditAction } from '../audit/decorators/audit-action.decorator';
import { AuditInterceptor } from '../audit/interceptors/audit.interceptor';

@ApiTags('References')
@ApiBearerAuth()
@Controller('references')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class ReferencesController {
  constructor(private readonly referencesService: ReferencesService) {}

  @Post('presign')
  @RequirePermissions('references:manage')
  @ApiOperation({ summary: 'Generate 5-minute presigned MinIO upload URL (validates type, size <= 15MB, MIME allowlist)' })
  @AuditAction('PRESIGN_REFERENCE_UPLOAD', 'ReferenceImage', (req) => req.body.caseId)
  async presign(@Body() dto: PresignReferenceUploadDto) {
    return this.referencesService.generatePresignedUpload(dto);
  }

  @Post()
  @RequirePermissions('references:manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Register uploaded reference image (strips EXIF, enforces resolution bounds, detects duplicates, emits references.uploaded)' })
  @AuditAction('REGISTER_REFERENCE', 'ReferenceImage', (req, res) => res?.referenceId || req.body?.caseId)
  async register(
    @Body() dto: RegisterReferenceDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.referencesService.registerReference(dto, file, actor);
  }

  @Patch(':id')
  @RequirePermissions('references:manage')
  @ApiOperation({ summary: 'Update reference metadata (type label, photoTakenAt, source, selectedFaceBox, isPrimary)' })
  @AuditAction('PATCH_REFERENCE', 'ReferenceImage', (req) => req.params.id)
  async patchReference(
    @Param('id') id: string,
    @Body() dto: PatchReferenceDto,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.referencesService.patchReference(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('references:manage')
  @ApiOperation({ summary: 'Soft delete reference + remove vectors from Pinecone + increment setVersion' })
  @AuditAction('DELETE_REFERENCE', 'ReferenceImage', (req) => req.params.id)
  async deleteReference(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.referencesService.deleteReference(id, actor);
  }

  @Post(':id/replace')
  @RequirePermissions('references:manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Replace enrolled reference image (purges old vectors, increments setVersion, emits references.uploaded)' })
  @AuditAction('REPLACE_REFERENCE', 'ReferenceImage', (req, res) => res?.referenceId || req.params.id)
  async replaceReference(
    @Param('id') id: string,
    @Body() dto: RegisterReferenceDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.referencesService.replaceReference(id, dto, file, actor);
  }

  @Post(':id/reprocess')
  @RequirePermissions('references:manage')
  @ApiOperation({ summary: 'Re-run analysis on reference image (e.g. after manual crop adjustment)' })
  @AuditAction('REPROCESS_REFERENCE', 'ReferenceImage', (req) => req.params.id)
  async reprocessReference(
    @Param('id') id: string,
    @Body() dto: ReprocessReferenceDto,
    @Req() req: any,
  ) {
    const actor = req?.user?.email || 'Investigator';
    return this.referencesService.reprocessReference(id, dto, actor);
  }

  // Legacy case-scoped upload adapter
  @Post('../cases/:caseId/references/upload')
  @RequirePermissions('references:manage')
  @UseGuards(CaseAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload reference photo for missing person case' })
  @AuditAction('UPLOAD_REFERENCE', 'Case', (req) => req.params.caseId)
  async uploadForCase(
    @Param('caseId') caseId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type?: string,
    @Req() req?: any,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const actor = req?.user?.email || 'Investigator';
    return this.referencesService.processUpload(caseId, file, type || 'face_front', {}, actor);
  }
}
