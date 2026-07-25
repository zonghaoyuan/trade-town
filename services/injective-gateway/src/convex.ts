import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { GatewayConfig } from './config';
import type { ChainAccountSnapshot, ChainFill, ChainMarketSnapshot, ChainOrder } from './injective';

type PendingIntent = {
  intentId: string;
  cid: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  limitPrice?: number;
  subaccountNonce: number;
};

export class FinanceCacheClient {
  private readonly client?: ConvexHttpClient;
  private readonly secret?: string;

  constructor(config: GatewayConfig) {
    if (config.convexUrl && config.gatewaySecret) {
      this.client = new ConvexHttpClient(config.convexUrl);
      this.secret = config.gatewaySecret;
    }
  }

  get configured() {
    return Boolean(this.client && this.secret);
  }

  async pendingIntents(): Promise<PendingIntent[]> {
    if (!this.client || !this.secret) {
      return [];
    }
    return (await this.client.query((api as any).finance.pendingIntents, {
      gatewaySecret: this.secret,
      limit: 25,
    })) as PendingIntent[];
  }

  async recordSubmission(
    intentId: string,
    submission: { txHash: string; blockHeight?: number; rawLog?: string },
  ) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.recordSubmission, {
      gatewaySecret: this.secret,
      intentId,
      ...submission,
    });
  }

  async recordFailure(intentId: string, error: string) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.recordFailure, {
      gatewaySecret: this.secret,
      intentId,
      error,
    });
  }

  async updateStatus(args: {
    status: 'read_only' | 'signing' | 'degraded' | 'unconfigured';
    operatorAddress?: string;
    blockHeight?: number;
    error?: string;
  }) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.updateGatewayStatus, {
      gatewaySecret: this.secret,
      ...args,
    });
  }

  async recordMarketSnapshot(snapshot: ChainMarketSnapshot) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.recordMarketSnapshot, {
      gatewaySecret: this.secret,
      ...snapshot,
    });
  }

  async recordAccountSnapshot(snapshot: ChainAccountSnapshot) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.recordAccountSnapshot, {
      gatewaySecret: this.secret,
      ...snapshot,
    });
  }

  async recordOrder(order: ChainOrder) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.recordOrder, {
      gatewaySecret: this.secret,
      ...order,
    });
  }

  async recordFill(fill: ChainFill) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.recordFill, {
      gatewaySecret: this.secret,
      ...fill,
    });
  }

  async recordCursor(stream: string, cursor: string, blockHeight: number) {
    if (!this.client || !this.secret) {
      return;
    }
    await this.client.mutation((api as any).finance.recordChainCursor, {
      gatewaySecret: this.secret,
      stream,
      cursor,
      blockHeight,
    });
  }
}
