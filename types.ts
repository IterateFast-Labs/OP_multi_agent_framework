
export interface FrameworkConfig {
  iterations: number;
  seed?: number | null;
  temperature?: number;
  description: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  model: string;
  prompt: string;
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  responseSchema?: Record<string, any>;
  maxOutputTokens?: number;
  thinkingConfig?: { thinkingBudget: number };
}

export interface AgentOutput {
  id: string;
  agentName: string;
  content: string; // Will store raw string or JSON string from agent
  isLoading: boolean;
  data?: Record<string, any>; // Generic object for parsed JSON
}

export interface UserChatMessage {
  type: 'user' | 'agent';
  agentId: string;
  agentName: string;
  message: string;
}

export interface SystemChatMessage {
    type: 'system';
    message: string;
}

export type ChatMessage = UserChatMessage | SystemChatMessage;


export interface ExpertOpinion {
    name: string;
    summary: string;
    feasibilityScore: number;
    rawOutput?: string;
    timestamp?: string;
    discussionHistory?: UserChatMessage[];
    iteration?: number;
}

export interface DataSource {
    id:string;
    name: string;
    data: any;
}

export interface ProposalData {
  proposal_info: string;
  date: string;
  url: string;
}

export type ToolFunction = (context: Record<string, any>) => string;