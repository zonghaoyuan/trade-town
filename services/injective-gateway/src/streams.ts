import { IndexerGrpcSpotStreamV2, StreamManagerV2 } from '@injectivelabs/sdk-ts';
import { getNetworkEndpoints, Network } from '@injectivelabs/networks';

export type StreamEvent = {
  stream: 'trades' | 'orders';
  receivedAt: number;
  payload: unknown;
};

export class InjectiveStreams {
  private readonly stream = new IndexerGrpcSpotStreamV2(
    getNetworkEndpoints(Network.Testnet).indexer,
  );
  private readonly managers: StreamManagerV2<unknown>[] = [];

  start(args: {
    marketIds: string[];
    subaccountIds?: string[];
    onEvent: (event: StreamEvent) => void;
  }) {
    if (args.marketIds.length === 0) {
      return;
    }
    const tradeManager: StreamManagerV2<unknown> = new StreamManagerV2<unknown>({
      id: 'trade-town-spot-trades',
      streamFactory: () =>
        this.stream.streamTrades({
          marketIds: args.marketIds,
          callback: (response: unknown) => tradeManager.emit('data', response),
        }),
      onData: (payload: unknown) =>
        args.onEvent({ stream: 'trades', payload, receivedAt: Date.now() }),
      retryConfig: { enabled: true },
    });
    tradeManager.on('error', (error: unknown) => {
      console.error('[stream:trades]', safeError(error));
    });
    tradeManager.start();
    this.managers.push(tradeManager);

    for (const subaccountId of args.subaccountIds ?? []) {
      const orderManager: StreamManagerV2<unknown> = new StreamManagerV2<unknown>({
        id: `trade-town-orders-${subaccountId.slice(-8)}`,
        streamFactory: () =>
          this.stream.streamOrders({
            subaccountId,
            callback: (response: unknown) => orderManager.emit('data', response),
          }),
        onData: (payload: unknown) =>
          args.onEvent({ stream: 'orders', payload, receivedAt: Date.now() }),
        retryConfig: { enabled: true },
      });
      orderManager.on('error', (error: unknown) => {
        console.error('[stream:orders]', safeError(error));
      });
      orderManager.start();
      this.managers.push(orderManager);
    }
  }

  stop() {
    for (const manager of this.managers) {
      manager.stop();
    }
    this.managers.length = 0;
  }
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
