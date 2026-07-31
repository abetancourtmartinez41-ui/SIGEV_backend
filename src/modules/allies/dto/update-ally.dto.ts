import { PartialType } from '@nestjs/swagger';
import { CreateAllyDto } from './create-ally.dto';

export class UpdateAllyDto extends PartialType(CreateAllyDto) {}
