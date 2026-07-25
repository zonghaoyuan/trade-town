import { timingSafeEqual } from 'node:crypto';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import { DefaultRequestHandler } from '@a2a-js/sdk/server';
import { UserBuilder, agentCardHandler, jsonRpcHandler } from '@a2a-js/sdk/server/express';
import express, { NextFunction, Request, Response } from 'express';
import { buildAgentCard } from './agentCard';
import { A2AConfig } from './config';
import { MarketTownAgentExecutor } from './executor';
import { createTaskStore } from './taskStore';

export function createA2AApp(config: A2AConfig) {
  const agentCard = buildAgentCard(config);
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    createTaskStore(config),
    new MarketTownAgentExecutor(config),
  );
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({
      ok: true,
      agent: agentCard.name,
      version: agentCard.version,
      executionMode: config.executionMode,
      persistence: config.convexUrl ? 'convex' : 'memory',
      modelConfigured: Boolean(config.deepseekModel),
      modelRole: config.deepseekModel ? 'task-planning-and-report-synthesis' : 'not-configured',
    });
  });
  app.get('/docs', (_req, res) => {
    res.json({
      agentCard: `${config.publicBaseUrl}/.well-known/agent-card.json`,
      jsonRpc: `${config.publicBaseUrl}/a2a/v1`,
      protocolVersions: ['1.0', '0.3'],
      authentication: config.apiKey ? 'Authorization: Bearer <token>' : 'none (local demo only)',
      examples: agentCard.skills.map((skill) => ({
        skillId: skill.id,
        prompt: skill.examples[0],
      })),
      disclosure:
        config.executionMode === 'competition'
          ? 'Competition mode requires DeepSeek and Convex persistence. PandaAI historical bars are real inputs; replay decisions remain simulated.'
          : 'PandaAI historical bars are real inputs; resident decisions and orders remain simulated and contain no chain proofs.',
    });
  });
  app.use(
    `/${AGENT_CARD_PATH}`,
    agentCardHandler({
      agentCardProvider: requestHandler,
      legacyCompat: { enabled: true },
    }),
  );
  app.use(
    '/a2a/v1',
    createRateLimiter(config.rateLimitPerMinute),
    createBearerAuth(config.apiKey),
    rejectOversizedContentLength(100_000),
    jsonRpcHandler({
      requestHandler,
      userBuilder: UserBuilder.noAuthentication,
      legacyCompat: { enabled: true },
    }),
  );

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: message.slice(0, 300) });
  });
  return app;
}

function createBearerAuth(apiKey: string | undefined) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!apiKey) {
      next();
      return;
    }
    const authorization = req.header('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!constantTimeEqual(token, apiKey)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  };
}

function constantTimeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function rejectOversizedContentLength(maxBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const length = Number(req.header('content-length') ?? 0);
    if (Number.isFinite(length) && length > maxBytes) {
      res.status(413).json({ error: 'Request body is too large.' });
      return;
    }
    next();
  };
}

function createRateLimiter(limit: number) {
  const windows = new Map<string, { start: number; count: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = windows.get(key);
    if (!current || now - current.start >= 60_000) {
      windows.set(key, { start: now, count: 1 });
      next();
      return;
    }
    current.count += 1;
    if (current.count > limit) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: 'Rate limit exceeded.' });
      return;
    }
    if (windows.size > 10_000) {
      for (const [storedKey, window] of windows) {
        if (now - window.start >= 60_000) {
          windows.delete(storedKey);
        }
      }
    }
    next();
  };
}
