import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;

    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle().pipe(
        tap((responseBody: any) => {
          const entityType = this.extractEntityType(url);
          if (entityType) {
            this.auditService.log({
              entityType,
              entityId: responseBody?.id || request.params.id,
              action: `${method} ${url}`,
              previousValue: request.body?._previous || null,
              newValue: responseBody || request.body,
              userId: user?.id,
              userEmail: user?.email,
              ipAddress: request.ip,
            });
          }
        }),
      );
    }

    return next.handle();
  }

  private extractEntityType(url: string): string | null {
    const parts = url.split('/').filter(Boolean);
    return parts.length > 0 ? parts[0] : null;
  }
}
