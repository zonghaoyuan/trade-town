import { A2A_PROTOCOL_VERSION, AgentCard } from '@a2a-js/sdk';
import { duplicateInterfacesForLegacy } from '@a2a-js/sdk/compat/v0_3';
import { A2AConfig } from './config';

export function buildAgentCard(config: A2AConfig): AgentCard {
  const securityRequirements = config.apiKey ? [{ schemes: { bearerAuth: { list: [] } } }] : [];
  return {
    name: 'AI Financial Town Research Agent',
    description:
      '在可复算的金融小镇中执行宏观冲击、谣言传播和用户行为复盘，并返回证据、风险结论与反事实。',
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
    version: '0.1.0',
    documentationUrl: `${config.publicBaseUrl}/docs`,
    capabilities: {
      streaming: true,
      pushNotifications: false,
      extensions: [],
      extendedAgentCard: false,
    },
    securitySchemes: config.apiKey
      ? {
          bearerAuth: {
            scheme: {
              $case: 'httpAuthSecurityScheme',
              value: {
                description: 'PandaAI 评审调用使用的 Bearer Token。',
                scheme: 'Bearer',
                bearerFormat: 'opaque',
              },
            },
          },
        }
      : {},
    securityRequirements,
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
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
