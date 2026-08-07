import {
  Controller, Get, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { ROLES } from '../../config/constants';

@ApiTags('Auditoría')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(
  ROLES.TECHNICAL_ADMIN,
  ROLES.FUNCTIONAL_ADMIN,
  ROLES.SUPERVISOR,
  ROLES.APPROVER,
  ROLES.AUDITOR,
)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar trazabilidad (últimos 100 registros)' })
  findAll() {
    return this.auditService.findAll();
  }

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Consultar trazabilidad de una entidad' })
  findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(entityType, entityId);
  }
}
