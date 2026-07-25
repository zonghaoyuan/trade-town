import { randomUUID } from 'node:crypto';
import {
  Artifact,
  Message,
  Role,
  Task,
  TaskArtifactUpdateEvent,
  TaskState,
  TaskStatusUpdateEvent,
} from '@a2a-js/sdk';
import { AgentEvent, AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { A2AConfig } from './config';
import { DeepSeekReasoner } from './reasoner';
import { runSkill } from './skills';

export class MarketTownAgentExecutor implements AgentExecutor {
  private readonly canceled = new Set<string>();
  private readonly taskContexts = new Map<string, string>();
  private readonly reasoner: DeepSeekReasoner;

  constructor(private readonly config: A2AConfig) {
    this.reasoner = new DeepSeekReasoner(config);
  }

  cancelTask = async (taskId: string, eventBus: ExecutionEventBus) => {
    this.canceled.add(taskId);
    eventBus.publish(
      AgentEvent.statusUpdate({
        taskId,
        contextId: this.taskContexts.get(taskId) ?? '',
        status: {
          state: TaskState.TASK_STATE_CANCELED,
          timestamp: new Date().toISOString(),
          message: undefined,
        },
        metadata: { reason: 'client-requested' },
      }),
    );
  };

  execute = async (requestContext: RequestContext, eventBus: ExecutionEventBus) => {
    const startedAt = Date.now();
    const { taskId, contextId, userMessage } = requestContext;
    this.taskContexts.set(taskId, contextId);
    const task: Task = requestContext.task ?? {
      id: taskId,
      contextId,
      status: {
        state: TaskState.TASK_STATE_SUBMITTED,
        timestamp: new Date().toISOString(),
        message: undefined,
      },
      artifacts: [],
      history: [userMessage],
      metadata: {
        agent: 'AI Financial Town Research Agent',
        schemaVersion: '1.0',
      },
    };
    eventBus.publish(AgentEvent.task(task));

    try {
      this.publishWorking(taskId, contextId, eventBus);
      const plan = await withTimeout(
        this.reasoner.planRequest(userMessage),
        this.config.maxTaskMs,
      );
      const skillResult = runSkill(plan.request, this.config.executionMode);
      const result = {
        ...skillResult,
        execution: {
          ...skillResult.execution,
          steps: [
            `${plan.usedModel ? 'DeepSeek V4 Pro' : '本地确定性路由'}完成任务规划：${plan.rationale}`,
            ...skillResult.execution.steps,
          ],
        },
      };
      const report = await withTimeout(
        this.reasoner.completeReport(result, startedAt, plan),
        this.config.maxTaskMs,
      );
      if (this.canceled.has(taskId)) {
        return;
      }

      const artifact: Artifact = {
        artifactId: randomUUID(),
        name: 'MarketTownReport',
        description: `${report.title}的结构化、可解释结果`,
        parts: [
          {
            content: {
              $case: 'text',
              value: `${report.title}\n\n${report.model.analysis}\n\n风险结论：${report.riskConclusion}`,
            },
            metadata: { language: 'zh-CN' },
            filename: '',
            mediaType: 'text/plain',
          },
          {
            content: {
              $case: 'data',
              value: report,
            },
            metadata: {
              schema: 'MarketTownReport/1.0',
              isSimulated: report.execution.isSimulated,
              marketDataIsReal: report.marketData?.isReal ?? false,
            },
            filename: 'market-town-report.json',
            mediaType: 'application/json',
          },
        ],
        metadata: {
          skillId: report.skillId,
          runId: report.runId,
          dataMode: report.execution.dataMode,
          marketDataSource: report.marketData?.source ?? '',
        },
        extensions: [],
      };
      const artifactUpdate: TaskArtifactUpdateEvent = {
        taskId,
        contextId,
        artifact,
        lastChunk: true,
        append: false,
        metadata: { schemaVersion: '1.0' },
      };
      eventBus.publish(AgentEvent.artifactUpdate(artifactUpdate));
      this.publishFinal(taskId, contextId, TaskState.TASK_STATE_COMPLETED, eventBus);
    } catch (error) {
      this.publishFinal(
        taskId,
        contextId,
        TaskState.TASK_STATE_FAILED,
        eventBus,
        safeErrorMessage(error),
      );
    } finally {
      this.canceled.delete(taskId);
      this.taskContexts.delete(taskId);
    }
  };

  private publishWorking(taskId: string, contextId: string, eventBus: ExecutionEventBus) {
    const update: TaskStatusUpdateEvent = {
      taskId,
      contextId,
      status: {
        state: TaskState.TASK_STATE_WORKING,
        timestamp: new Date().toISOString(),
        message: agentMessage(
          taskId,
          contextId,
          '正在校验任务、运行确定性金融规则并生成可解释报告。',
        ),
      },
      metadata: { stage: 'financial-analysis' },
    };
    eventBus.publish(AgentEvent.statusUpdate(update));
  }

  private publishFinal(
    taskId: string,
    contextId: string,
    state: TaskState,
    eventBus: ExecutionEventBus,
    message?: string,
  ) {
    eventBus.publish(
      AgentEvent.statusUpdate({
        taskId,
        contextId,
        status: {
          state,
          timestamp: new Date().toISOString(),
          message: message ? agentMessage(taskId, contextId, message) : undefined,
        },
        metadata: {},
      }),
    );
  }
}

function agentMessage(taskId: string, contextId: string, text: string): Message {
  return {
    messageId: randomUUID(),
    contextId,
    taskId,
    role: Role.ROLE_AGENT,
    parts: [
      {
        content: { $case: 'text', value: text },
        metadata: undefined,
        filename: '',
        mediaType: 'text/plain',
      },
    ],
    metadata: {},
    extensions: [],
    referenceTaskIds: [],
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('任务超过内部响应时限。')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function safeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '未知任务错误';
  return `任务失败：${message.slice(0, 500)}`;
}
