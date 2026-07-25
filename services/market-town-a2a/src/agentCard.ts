import { A2A_PROTOCOL_VERSION, AgentCard } from '@a2a-js/sdk';
import { duplicateInterfacesForLegacy } from '@a2a-js/sdk/compat/v0_3';
import { A2AConfig } from './config';

export function buildAgentCard(config: A2AConfig): AgentCard {
  const securityRequirements: AgentCard['securityRequirements'] = [];
  return {
    name: 'AI Financial Town Research Agent',
    description:
      '理解其他 Agent 的金融问题，调用 PandaAI 历史行情和金融小镇工具，并基于可审计数据直接生成回答、证据与风险结论。',
    supportedInterfaces: duplicateInterfacesForLegacy(
      [
        {
          url: `${config.publicBaseUrl}/a2a/v1`,
          protocolBinding: 'JSONRPC',
          tenant: '',
          protocolVersion: A2A_PROTOCOL_VERSION,
        },
      ],
      ['JSONRPC'],
    ),
    provider: {
      organization: 'Injective Trade Town',
      url: config.publicBaseUrl,
    },
    version: '0.3.0',
    documentationUrl: `${config.publicBaseUrl}/docs`,
    capabilities: {
      streaming: true,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false,
    },
    securitySchemes: {},
    securityRequirements,
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
      {
        id: 'town-agent-history',
        name: '30 交易日 Agent 分析问答',
        description:
          '读取当前 Trade Town 运行中单个 Agent 的 30 个交易日信念、观点、账户、持仓和交易记录，并针对调用方问题生成分析回答。',
        tags: ['A2A', 'Agent 问答', '30 交易日', '数据分析', 'PandaAI'],
        examples: [
          '根据 agentId=agent-01 的 30 个交易日数据，解释它的风险偏好发生了什么变化，并列出依据。',
        ],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        securityRequirements,
      },
      {
        id: 'panda-market-replay',
        name: 'PandaAI 真实历史行情回放',
        description:
          '读取 5 只 A 股的 PandaAI 授权真实历史日线及指标，并生成明确标记为模拟的居民观点、风控和组合回放。',
        tags: ['PandaAI', '真实历史数据', '行情回放', '可解释'],
        examples: ['分析 PandaAI 数据中 002594.SZ 的历史走势，并总结 8 个居民的分歧。'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        securityRequirements,
      },
      {
        id: 'rate-shock-experiment',
        name: '利率冲击实验',
        description: '在固定 Seed 下模拟利率冲击、居民观点变化、交易意图和确定性风控。',
        tags: ['金融情景', '宏观', '风险', '可解释'],
        examples: ['运行加息 100bp 实验，seed=20260722，并总结 8 个居民的分歧。'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        securityRequirements,
      },
      {
        id: 'rumor-propagation-analysis',
        name: '谣言传播与更正分析',
        description: '追踪消息传播路径、信念变化和权威更正效果，不伪造真实订单。',
        tags: ['传播网络', '谣言', '更正', '证据链'],
        examples: ['分析 ACME 谣言的传播路径，并比较权威更正前后的居民决策。'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        securityRequirements,
      },
      {
        id: 'user-behavior-review',
        name: '用户数字分身行为复盘',
        description: '识别仓位、从众和损失厌恶偏差，输出风险规则与两个可复算反事实。',
        tags: ['行为金融', '数字分身', '反事实', '风险提示'],
        examples: ['复盘一个保守型用户单笔使用 18% NAV 的行为，并给出两个反事实。'],
        inputModes: ['text/plain', 'application/json'],
        outputModes: ['text/plain', 'application/json'],
        securityRequirements,
      },
    ],
    signatures: [],
  };
}
