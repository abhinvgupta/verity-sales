import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result) => {
        // Paginated responses return { data, meta } — spread to top level
        if (result !== null && typeof result === 'object' && 'meta' in result) {
          return { success: true, ...result };
        }
        return { success: true, data: result };
      }),
    );
  }
}
