import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Case, CaseDocument } from '../../cases/schemas/case.schema';

@Injectable()
export class CaseAccessGuard implements CanActivate {
  constructor(
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return false;
    }

    // Super Admin has unrestricted operational access
    if (user.role === 'Super Admin') {
      return true;
    }

    const caseId = request.params?.id || request.params?.caseId || request.body?.caseId;
    if (!caseId) {
      return true; // No caseId associated with this route
    }

    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) {
      return true; // Let controller handle 404
    }

    // Rule 3: Minors and vulnerable persons get extra access controls
    const isRestrictedTarget = caseDoc.isMinor || caseDoc.isVulnerable;

    if (isRestrictedTarget) {
      const isAssigned =
        (caseDoc.assignedOfficer && (caseDoc.assignedOfficer === user.name || caseDoc.assignedOfficer === user.id || caseDoc.assignedOfficer === user.email)) ||
        (caseDoc.accessList && (caseDoc.accessList.includes(user.id) || caseDoc.accessList.includes(user.email)));

      if (!isAssigned) {
        throw new ForbiddenException(
          'Access restricted: Minor and vulnerable person dossiers require explicit investigator assignment or Super Admin credentials.',
        );
      }
    }

    // If an explicit accessList is defined on any case, enforce membership
    if (caseDoc.accessList && caseDoc.accessList.length > 0) {
      const hasAccess =
        caseDoc.accessList.includes(user.id) ||
        caseDoc.accessList.includes(user.email) ||
        caseDoc.assignedOfficer === user.name ||
        caseDoc.assignedOfficer === user.id;

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access permission for this restricted case');
      }
    }

    // Attach caseDoc to request for downstream handlers
    request.caseDoc = caseDoc;
    return true;
  }
}
