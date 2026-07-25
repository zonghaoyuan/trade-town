import type { TownTransactionRecord } from '../../../shared/activity';
import type { DashboardExecution } from '../../finance/demoData';

export function mergeTransactions(
  liveTransactions: TownTransactionRecord[],
  executions: DashboardExecution[],
  contextAsOf?: number,
): TownTransactionRecord[] {
  const seen = new Set(liveTransactions.map((transaction) => transaction.id));
  const paperTransactions = executions
    .filter(
      (execution) =>
        execution.isSimulated &&
        execution.type !== 'order' &&
        !seen.has(execution.id),
    )
    .map(
      (execution): TownTransactionRecord => ({
        id: execution.id,
        occurredAt:
          execution.occurredAt ??
          fallbackExecutionTime(contextAsOf ?? Date.now(), execution.time),
        agentName: execution.agentName,
        symbol: execution.symbol,
        side: execution.side.toLowerCase() as 'buy' | 'sell',
        quantity: execution.quantity,
        price: execution.price,
        state: execution.type === 'fill' ? 'filled' : 'risk_rejected',
        source: 'paper',
        detail:
          execution.reason ??
          `${execution.reference ?? 'Panda replay'} · simulated, no chain submission`,
      }),
    );

  if (paperTransactions.length > 0) {
    const verifiedTransactions = liveTransactions.filter(
      (transaction) => transaction.source === 'injective',
    );
    return [
      ...paperTransactions.sort((left, right) => right.occurredAt - left.occurredAt),
      ...verifiedTransactions.sort((left, right) => right.occurredAt - left.occurredAt),
    ].slice(0, 80);
  }

  return [...liveTransactions]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, 80);
}

function fallbackExecutionTime(asOf: number, clock: string) {
  const [hours = 15, minutes = 0, seconds = 0] = clock.split(':').map(Number);
  const date = new Date(asOf);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hours - 8,
    minutes,
    seconds,
  );
}
