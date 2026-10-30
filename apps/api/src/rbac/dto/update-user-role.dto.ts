import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, ROLE_KEYS } from '@sentinel/shared-types';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role to assign to the user',
    enum: ROLE_KEYS,
    example: 'investigator',
  })
  role: Role;

  @ApiProperty({
    description: 'Reason for the role assignment (recorded in CJIS audit log)',
    example: 'Transferred to lead detective on Operation Sentinel',
  })
  reason: string;

  @ApiPropertyOptional({
    description:
      'Approving supervisor user ID (mandatory under Four-Eyes Policy when promoting to super_admin)',
    example: '60d0fe4f5311236168a109ca',
  })
  fourEyesApproverId?: string;
}
