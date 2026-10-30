import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { normalizeRole, Role, Permission } from '@sentinel/shared-types';

@Injectable()
export class RbacDataShapingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      map((data) => {
        if (!data || !user) {
          return data;
        }

        const role = user.role ? normalizeRole(user.role) : ('viewer' as Role);
        const permissions: Permission[] = user.permissions || [];

        const hasContactPii = permissions.includes('pii:view_contact');
        const hasMedicalPii = permissions.includes('pii:view_medical');

        return this.shapeResponse(data, role, hasContactPii, hasMedicalPii, user.id, user.team);
      }),
    );
  }

  private shapeResponse(
    payload: any,
    role: Role,
    hasContactPii: boolean,
    hasMedicalPii: boolean,
    userId: string,
    teamId?: string,
  ): any {
    if (payload === null || payload === undefined || typeof payload !== 'object') {
      return payload;
    }

    if (Array.isArray(payload)) {
      return payload
        .filter((item) => this.filterByReviewerAssignment(item, role, userId, teamId))
        .map((item) => this.shapeItem(item, role, hasContactPii, hasMedicalPii));
    }

    // Paginated structure: { data: [...], total, ... } or { items: [...], ... }
    if (Array.isArray(payload.data)) {
      const filtered = payload.data
        .filter((item: any) => this.filterByReviewerAssignment(item, role, userId, teamId))
        .map((item: any) => this.shapeItem(item, role, hasContactPii, hasMedicalPii));
      return {
        ...payload,
        data: filtered,
        total: payload.total !== undefined ? filtered.length : undefined,
      };
    }

    if (Array.isArray(payload.items)) {
      const filtered = payload.items
        .filter((item: any) => this.filterByReviewerAssignment(item, role, userId, teamId))
        .map((item: any) => this.shapeItem(item, role, hasContactPii, hasMedicalPii));
      return {
        ...payload,
        items: filtered,
        total: payload.total !== undefined ? filtered.length : undefined,
      };
    }

    return this.shapeItem(payload, role, hasContactPii, hasMedicalPii);
  }

  private filterByReviewerAssignment(item: any, role: Role, userId: string, teamId?: string): boolean {
    if (role !== 'reviewer' || !item || typeof item !== 'object') {
      return true;
    }

    // If item represents a case, check assignment
    if (item.caseNumber || item.targetName || item.missingPersonName) {
      const isAssignedUser =
        item.assignedOfficerId === userId ||
        item.assignedOfficer === userId ||
        item.assignedTo === userId ||
        (Array.isArray(item.accessList) && item.accessList.includes(userId));

      const isAssignedTeam = teamId && (item.assignedTeam === teamId || item.teamId === teamId);

      // If neither assigned to user nor team, exclude from reviewer listing
      if (!isAssignedUser && !isAssignedTeam && (item.assignedOfficerId || item.assignedTeam)) {
        return false;
      }
    }

    return true;
  }

  private shapeItem(item: any, role: Role, hasContactPii: boolean, hasMedicalPii: boolean): any {
    if (item === null || item === undefined || typeof item !== 'object') {
      return item;
    }

    // If item is a Mongoose document, convert to plain object
    const obj = item.toObject ? item.toObject() : { ...item };

    // Viewer role specific shaping
    if (role === 'viewer') {
      // Blur face thumbnails
      if (obj.faceCropUrl || obj.cropUrl || obj.thumbnailUrl || obj.avatarUrl) {
        obj.blurred = true;
        obj.faceBlurRequired = true;
      }
      // Mask subject names if present in sightings/cases
      if (obj.targetName) {
        const idSuffix = String(obj._id || obj.id || '0000').slice(-4);
        obj.targetName = `Subject #${idSuffix}`;
      }
      if (obj.missingPersonName) {
        const idSuffix = String(obj._id || obj.id || '0000').slice(-4);
        obj.missingPersonName = `Subject #${idSuffix}`;
      }
    }

    // PII Contact Redaction
    if (!hasContactPii) {
      if (obj.reporterContact) delete obj.reporterContact;
      if (obj.reporterPhone) delete obj.reporterPhone;
      if (obj.emergencyContact) delete obj.emergencyContact;
      if (obj.contactNumber) delete obj.contactNumber;
      if (obj.phone) delete obj.phone;
      if (obj.personalNotes) delete obj.personalNotes;
      if (obj.ssn) delete obj.ssn;
      if (obj.homeAddress) delete obj.homeAddress;
      if (obj.address && typeof obj.address === 'string') delete obj.address;
    }

    // PII Medical Redaction
    if (!hasMedicalPii) {
      if (obj.medicalConditions) delete obj.medicalConditions;
      if (obj.medications) delete obj.medications;
      if (obj.allergies) delete obj.allergies;
      if (obj.mentalHealthNotes) delete obj.mentalHealthNotes;
      if (obj.cognitiveStatus) delete obj.cognitiveStatus;
    }

    return obj;
  }
}
