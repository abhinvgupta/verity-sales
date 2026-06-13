import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtPayload } from '@verity/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AnalyticsService } from './analytics.service';
import { ObjectionsService } from './objections.service';
import {
  AnalyticsQuerySchema,
  AnalyticsQueryDto,
} from './dto/analytics-query.dto';
import {
  ObjectionsQuerySchema,
  ObjectionsQueryDto,
  ObjectionTypeSchema,
  ResolutionPathQuerySchema,
  ResolutionPathQueryDto,
} from './dto/objections-query.dto';

const QueryPipe = new ZodValidationPipe(AnalyticsQuerySchema);
const ObjectionsQueryPipe = new ZodValidationPipe(ObjectionsQuerySchema);
const ObjectionTypePipe = new ZodValidationPipe(ObjectionTypeSchema);
const ResolutionQueryPipe = new ZodValidationPipe(ResolutionPathQuerySchema);

@Controller('analytics')
@Roles('company_admin', 'manager')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly objectionsService: ObjectionsService,
  ) {}

  @Get('overview')
  overview(
    @CurrentUser() user: JwtPayload,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.overview(user.companyId, query);
  }

  @Get('score-trend')
  scoreTrend(
    @CurrentUser() user: JwtPayload,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.scoreTrend(user.companyId, query);
  }

  @Get('leaderboard')
  leaderboard(
    @CurrentUser() user: JwtPayload,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.leaderboard(user.companyId, query);
  }

  @Get('top-issues')
  topIssues(
    @CurrentUser() user: JwtPayload,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.topIssues(user.companyId, query);
  }

  @Get('score-distribution')
  scoreDistribution(
    @CurrentUser() user: JwtPayload,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.scoreDistribution(user.companyId, query);
  }

  @Get('compliance')
  compliance(
    @CurrentUser() user: JwtPayload,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.compliance(user.companyId, query);
  }

  @Get('alignment-scatter')
  alignmentScatter(
    @CurrentUser() user: JwtPayload,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.alignmentScatter(user.companyId, query);
  }

  @Get('rep-radar/:repId')
  repRadar(
    @CurrentUser() user: JwtPayload,
    @Param('repId') repId: string,
    @Query(QueryPipe) query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.repRadar(user.companyId, repId, query);
  }

  /** Reps are allowed in — the service scopes them to their own calls. */
  @Get('objections')
  @Roles('company_admin', 'manager', 'rep')
  objections(
    @CurrentUser() user: JwtPayload,
    @Query(ObjectionsQueryPipe) query: ObjectionsQueryDto,
  ) {
    return this.objectionsService.list(user, query);
  }

  /**
   * Cache hit: plain JSON envelope. Cache miss (or ?regenerate=true): SSE
   * stream with `status`, `delta`, then one of `complete` /
   * `insufficient_data` / `error`. Clients branch on Content-Type.
   */
  @Get('objections/:type/resolution-path')
  @Roles('company_admin', 'manager', 'rep')
  async resolutionPath(
    @CurrentUser() user: JwtPayload,
    @Param('type', ObjectionTypePipe) type: string,
    @Query(ResolutionQueryPipe) query: ResolutionPathQueryDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Regeneration bypasses the cache and costs an LLM call — coaching
    // staff only. Reps still get cached/first-time generation below.
    if (query.regenerate && user.role === 'rep') {
      throw new ForbiddenException(
        'Only managers and admins can regenerate playbooks',
      );
    }

    if (!query.regenerate) {
      const cached = await this.objectionsService.getCachedPath(
        user.companyId,
        type,
      );
      if (cached) {
        res.json({ success: true, data: cached });
        return;
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Client disconnect cancels the in-flight LLM call.
    const abort = new AbortController();
    req.on('close', () => abort.abort());

    const send = (event: string, data: unknown) => {
      if (!res.writableEnded) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    };

    try {
      const result = await this.objectionsService.generatePath(
        user.companyId,
        type,
        {
          signal: abort.signal,
          onStage: (stage) => send('status', { stage }),
          onDelta: (text) => send('delta', { text }),
        },
      );

      if (result.kind === 'insufficient') {
        send('insufficient_data', {
          insufficientData: true,
          successfulCount: result.successfulCount,
          unsuccessfulCount: result.unsuccessfulCount,
        });
      } else if (result.kind === 'invalid') {
        send('error', { message: "Couldn't generate the playbook right now." });
      } else if (result.kind === 'busy') {
        send('error', {
          message:
            'This playbook is already being generated — try again in a moment.',
        });
      } else {
        send('complete', result.path);
      }
    } catch {
      // Aborted by the client — nothing left to tell it.
      if (!abort.signal.aborted) {
        send('error', { message: "Couldn't generate the playbook right now." });
      }
    } finally {
      res.end();
    }
  }
}
