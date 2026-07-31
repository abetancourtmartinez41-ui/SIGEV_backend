import {
  PipeTransform, Injectable, BadRequestException,
} from '@nestjs/common';

@Injectable()
export class PositiveNumberPipe implements PipeTransform {
  transform(value: unknown): number {
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      throw new BadRequestException('El valor no puede ser negativo');
    }
    return num;
  }
}
