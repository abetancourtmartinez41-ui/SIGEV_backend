import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ATTACHMENT_CATEGORIES } from '../attachments-folders';

export class UploadAttachmentDto {
  @ApiProperty({ enum: ATTACHMENT_CATEGORIES })
  @IsIn(ATTACHMENT_CATEGORIES)
  category: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  quotationId?: string;
}
