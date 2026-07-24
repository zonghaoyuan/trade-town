import { Artifact, ListTasksRequest, ListTasksResponse, Task, TaskState } from '@a2a-js/sdk';
import { InMemoryTaskStore, ServerCallContext, TaskStore } from '@a2a-js/sdk/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { A2AConfig } from './config';

type TaskRecord = {
  taskJson: string;
};

export function createTaskStore(config: A2AConfig): TaskStore {
  if (config.convexUrl && config.convexSecret) {
    return new ConvexTaskStore(config.convexUrl, config.convexSecret);
  }
  return new InMemoryTaskStore();
}

export class ConvexTaskStore implements TaskStore {
  private readonly client: ConvexHttpClient;

  constructor(
    convexUrl: string,
    private readonly secret: string,
  ) {
    this.client = new ConvexHttpClient(convexUrl);
  }

  async save(task: Task, _context: ServerCallContext) {
    const updatedAt = Date.now();
    await this.client.mutation((api as any).a2a.tasks.saveTask, {
      secret: this.secret,
      taskId: task.id,
      contextId: task.contextId,
      state: task.status?.state ?? TaskState.TASK_STATE_UNSPECIFIED,
      statusTimestamp: task.status?.timestamp,
      taskJson: JSON.stringify(Task.toJSON(task)),
      artifacts: task.artifacts.map((artifact) => ({
        artifactId: artifact.artifactId,
        name: artifact.name,
        artifactJson: JSON.stringify(Artifact.toJSON(artifact)),
      })),
      updatedAt,
    });
  }

  async load(taskId: string, _context: ServerCallContext) {
    const taskJson = (await this.client.query((api as any).a2a.tasks.loadTask, {
      secret: this.secret,
      taskId,
    })) as string | null;
    return taskJson ? Task.fromJSON(JSON.parse(taskJson)) : undefined;
  }

  async list(params: ListTasksRequest, _context: ServerCallContext): Promise<ListTasksResponse> {
    const records = (await this.client.query((api as any).a2a.tasks.listTaskRecords, {
      secret: this.secret,
      limit: 500,
    })) as TaskRecord[];
    const after = params.statusTimestampAfter
      ? Date.parse(params.statusTimestampAfter)
      : Number.NEGATIVE_INFINITY;
    const filtered = records
      .map((record) => Task.fromJSON(JSON.parse(record.taskJson)))
      .filter((task) => !params.contextId || task.contextId === params.contextId)
      .filter(
        (task) =>
          params.status === TaskState.TASK_STATE_UNSPECIFIED ||
          task.status?.state === params.status,
      )
      .filter((task) => {
        const timestamp = task.status?.timestamp ? Date.parse(task.status.timestamp) : 0;
        return timestamp >= after;
      });
    const pageSize = Math.max(1, Math.min(params.pageSize ?? 50, 100));
    const offset = parsePageToken(params.pageToken);
    const selected = filtered
      .slice(offset, offset + pageSize)
      .map((task) => shapeTask(task, params.historyLength, params.includeArtifacts ?? false));
    const nextOffset = offset + selected.length;
    return {
      tasks: selected,
      nextPageToken: nextOffset < filtered.length ? String(nextOffset) : '',
      pageSize,
      totalSize: filtered.length,
    };
  }
}

function parsePageToken(value: string) {
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Invalid A2A task page token.');
  }
  return parsed;
}

function shapeTask(task: Task, historyLength: number | undefined, includeArtifacts: boolean) {
  const copy = Task.fromJSON(Task.toJSON(task));
  if (!includeArtifacts) {
    copy.artifacts = [];
  }
  if (historyLength !== undefined) {
    copy.history = historyLength === 0 ? [] : copy.history.slice(-historyLength);
  }
  return copy;
}
