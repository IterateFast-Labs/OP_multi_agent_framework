
import React, { useState, useEffect, useCallback } from 'react';
import AgentOutputCard from './components/AgentOutputCard';
import DiscussionPanel from './components/DiscussionPanel';
import SummaryPanel from './components/SummaryPanel';
import ProposalInput from './components/ProposalInput';
import QAPanel from './components/QAPanel';
import { SaveIcon, LoadingSpinner, BrainCircuitIcon, BotIcon, MessageSquareIcon, TestTubeDiagonalIcon, ClockIcon, CPUChipIcon } from './components/icons';
import { AgentConfig, AgentOutput, ChatMessage, ExpertOpinion, FrameworkConfig, ProposalData, UserChatMessage, SystemChatMessage } from './types';
import { runAgentQuery } from './services/geminiService';
import { generatePdf } from './components/PdfGenerator';

// Performance tracking types
interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

interface AgentMetrics {
    duration: number;
    tokenUsage: TokenUsage;
    googleSearchUsage?: {
        used: boolean;
        queriesCount: number;
        sourcesCount: number;
        queries?: string[];
        sources?: Array<{
            title?: string;
            uri?: string;
            snippet?: string;
        }>;
        rawMetadata?: any;
    };
}

interface FrameworkMetrics {
    totalDuration: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    agentBreakdown: Record<string, AgentMetrics>;
    googleSearchSummary: {
        totalUsageCount: number;
        totalQueries: number;
        totalSources: number;
        agentsUsed: string[];
    };
}

const initialSection1Outputs: Record<string, AgentOutput> = {
    proposal_classification_agent: { id: 'proposal_classification_agent', agentName: 'Proposal Classification Agent', content: '', isLoading: true },
    proposal_information_summarize_agent: { id: 'proposal_information_summarize_agent', agentName: 'Proposal Information Summarize Agent', content: '', isLoading: true },
};

const initialFinalDecision: AgentOutput = { id: 'final_decision_agent', agentName: 'Feasibility Scoring Agent', content: '', isLoading: true };

// Helper function moved outside the component to make it pure and prevent re-creation on renders.
// It now accepts configs directly, removing dependency on component state.
const runAgent = async (agentId: string, configs: Record<string, AgentConfig>, dynamicPrompt?: string, useGoogleSearch?: boolean, seed?: number | null, temperature?: number): Promise<{ result: string; metrics: AgentMetrics }> => {
    if (!configs) {
        const errorMsg = "Error: Agent configs not provided.";
        console.error(errorMsg);
        return { result: errorMsg, metrics: { duration: 0, tokenUsage: { inputTokens: 0, outputTokens: 0 } } };
    }
    const config = configs[agentId];
    if (!config) {
        console.error(`No config found for agent: ${agentId}`);
        return { result: `Error: Config not found for ${agentId}`, metrics: { duration: 0, tokenUsage: { inputTokens: 0, outputTokens: 0 } } };
    }
    
    const prompt = dynamicPrompt || config.prompt;
    const startTime = performance.now();
    
    // Force temperature = 0 for classification and summarize agents for consistency
    const forceZeroTempAgents = ['proposal_classification_agent', 'proposal_information_summarize_agent'];
    const finalTemperature = forceZeroTempAgents.includes(agentId) ? 0 : temperature;
    
    // Estimate input tokens (rough approximation)
    const inputTokens = Math.ceil(prompt.length / 4);
    
    const { content: result, googleSearchMetadata } = await runAgentQuery({
        ...config,
        prompt: prompt,
        useGoogleSearch: useGoogleSearch,
        seed: seed,
        temperature: finalTemperature,
    });
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Estimate output tokens (rough approximation)
    const outputTokens = Math.ceil(result.length / 4);
    
    return {
        result,
        metrics: {
            duration,
            tokenUsage: {
                inputTokens,
                outputTokens
            },
            googleSearchUsage: googleSearchMetadata
        }
    };
};

const MAX_CONTEXT_TOKENS = 12000;

// Helper to approximate token count
const countTokens = (text: string): number => Math.ceil(text.length / 4);

/**
 * Truncates a prompt from the beginning if it exceeds the specified token limit.
 * @param prompt The full prompt string.
 * @param maxTokens The maximum number of tokens allowed.
 * @returns The original prompt or a truncated version.
 */
const truncatePromptIfNeeded = (prompt: string, maxTokens: number = MAX_CONTEXT_TOKENS): string => {
    const currentTokens = countTokens(prompt);
    if (currentTokens <= maxTokens) {
        return prompt;
    }

    const excessTokens = currentTokens - maxTokens;
    // Each token is roughly 4 characters. We remove from the beginning to preserve the most recent context.
    const charsToRemove = excessTokens * 4;

    // Find a clean cut-off point (start of a line) to not break formatting.
    let splitIndex = charsToRemove;
    while (splitIndex < prompt.length && prompt[splitIndex] !== '\n') {
        splitIndex++;
    }
    
    const truncatedPrompt = prompt.substring(splitIndex);
    
    console.warn(
        `Prompt was truncated to fit the token limit. Original tokens: ~${currentTokens}, New tokens: ~${countTokens(truncatedPrompt)}`
    );

    return `[... previous content truncated to fit token limit ...]\n\n${truncatedPrompt}`;
};


const App: React.FC = () => {
    const [originalAgentConfigs, setOriginalAgentConfigs] = useState<Record<string, AgentConfig> | null>(null);
    const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig> | null>(null);
    const [frameworkConfig, setFrameworkConfig] = useState<FrameworkConfig>({ iterations: 3, seed: null, temperature: 0, description: "" });
    const [proposal, setProposal] = useState<ProposalData | null>(null);
    const [initialContext, setInitialContext] = useState<string>('');

    const [section1Outputs, setSection1Outputs] = useState<Record<string, AgentOutput | null>>(initialSection1Outputs);
    const [discussionMessages, setDiscussionMessages] = useState<ChatMessage[]>([]);
    const [isDiscussionLoading, setIsDiscussionLoading] = useState<boolean>(true);
    const [finalDecision, setFinalDecision] = useState<AgentOutput | null>(initialFinalDecision);
    const [expertOpinions, setExpertOpinions] = useState<ExpertOpinion[]>([]);

    const [isSaving, setIsSaving] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'simulation' | 'qa'>('simulation');
    const [qaMessages, setQaMessages] = useState<ChatMessage[]>([]);
    const [isQaLoading, setIsQaLoading] = useState<boolean>(false);

    // Performance tracking state
    const [frameworkMetrics, setFrameworkMetrics] = useState<FrameworkMetrics | null>(null);
    const [performanceTracking, setPerformanceTracking] = useState<AgentOutput | null>(null);
    const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);
    const [useGeminiPro, setUseGeminiPro] = useState<boolean>(false);

    const updateAgentModels = useCallback((configs: Record<string, AgentConfig>, usePro: boolean) => {
        const updatedConfigs = { ...configs };
        Object.keys(updatedConfigs).forEach(key => {
            updatedConfigs[key] = {
                ...updatedConfigs[key],
                model: key.startsWith('expert_') 
                    ? (usePro ? 'gemini-2.5-pro' : 'gemini-2.5-flash')
                    : 'gemini-2.5-flash' // All non-expert agents always use Flash
            };
        });
        return updatedConfigs;
    }, []);

    // Update agent configs when Gemini Pro toggle changes
    React.useEffect(() => {
        if (originalAgentConfigs && !isSimulating) {
            const updatedConfigs = updateAgentModels(originalAgentConfigs, useGeminiPro);
            setAgentConfigs(updatedConfigs);
        }
    }, [useGeminiPro, originalAgentConfigs, updateAgentModels, isSimulating]);

    const resetState = useCallback(() => {
        if (!originalAgentConfigs) return;
        const configsToUse = updateAgentModels(originalAgentConfigs, useGeminiPro);
        setAgentConfigs(configsToUse); // Reset to original configs with model updates
        setSection1Outputs({
            proposal_classification_agent: { ...initialSection1Outputs.proposal_classification_agent, agentName: originalAgentConfigs.proposal_classification_agent.name },
            proposal_information_summarize_agent: { ...initialSection1Outputs.proposal_information_summarize_agent, agentName: originalAgentConfigs.proposal_information_summarize_agent.name },
        });
        setDiscussionMessages([]);
        setIsDiscussionLoading(true);
        setFinalDecision({ ...initialFinalDecision, agentName: originalAgentConfigs.final_decision_agent.name });
        setExpertOpinions([]);
        setQaMessages([]);
        setIsQaLoading(false);
        setActiveTab('simulation');
        setInitialContext('');
        setFrameworkMetrics(null);
        setPerformanceTracking(null);
    }, [originalAgentConfigs]);

    // Run a single complete iteration (Phase 3 + Phase 4)
    const runSingleIteration = useCallback(async (context: string, configsForRun: Record<string, AgentConfig>, metrics: FrameworkMetrics, googleSearchEnabled: boolean = false, iterationNumber: number) => {
        // --- Phase 3: Expert Discussion ---
        const expertAgentIds = ['expert_1', 'expert_2', 'expert_3'];
        let discussionHistory: UserChatMessage[] = [];
        const discussionTurns = 2; 

        console.log(`🔄 Starting iteration ${iterationNumber} - Phase 3: Expert Discussion`);

        for (let turn = 0; turn < discussionTurns; turn++) {
            for (const id of expertAgentIds) {
                const agentConfig = configsForRun[id];
                const historyText = discussionHistory.map(m => `${m.agentName}: ${m.message}`).join("\n\n") || "(No history yet. You are the first to speak.)";
                let dynamicPrompt = `
                ${context}
                
                Conversation History:
                ${historyText}
                
                Your instruction: ${agentConfig.systemInstruction}
                Here is the main conversation rules prompt :
                Communicate as a domain expert would, using professional terminology and drawing from established knowledge in your field. Express appropriate confidence levels and acknowledge areas of uncertainty.
                Before making claims, mentally verify information against your knowledge base. When uncertain, explicitly state your level of confidence (e.g., "Based on available evidence," "In my experience," or "This requires further verification").
                Ask probing questions that real experts would ask: What evidence supports this? What are the potential risks or limitations? Have similar approaches been tried before? What are the implementation challenges?
                When your assigned concerns have been adequately addressed with evidence or reasoning, acknowledge this clearly: "My concerns about [specific issue] have been resolved based on [specific reasoning/evidence provided]."
                Provide constructive criticism by identifying specific weaknesses and suggesting improvements rather than blanket rejections. Frame objections around evidence, feasibility, or potential consequences.
                While maintaining openness to well-reasoned proposals, maintain your professional standards. Accept proposals that demonstrate sound reasoning and evidence, but don't hesitate to reject those that are fundamentally flawed, unsafe, or lack sufficient justification.
                If a proposal is truly unacceptable due to serious flaws (safety issues, ethical concerns, technical impossibility), clearly articulate why and maintain your rejection while offering alternative directions when possible.`;

                dynamicPrompt = truncatePromptIfNeeded(dynamicPrompt);
                // Only use Google Search for expert agents in discussion
                const isExpertAgent = id.startsWith('expert_');
                const useSearchForThisAgent = googleSearchEnabled && isExpertAgent;
                const { result: content, metrics: agentMetrics } = await runAgent(id, configsForRun, dynamicPrompt, useSearchForThisAgent, frameworkConfig.seed, frameworkConfig.temperature);
                
                // Track metrics
                metrics.agentBreakdown[id] = (metrics.agentBreakdown[id] || { 
                    duration: 0, 
                    tokenUsage: { inputTokens: 0, outputTokens: 0 },
                    googleSearchUsage: { used: false, queriesCount: 0, sourcesCount: 0, queries: [], sources: [] }
                });
                metrics.agentBreakdown[id].duration += agentMetrics.duration;
                metrics.agentBreakdown[id].tokenUsage.inputTokens += agentMetrics.tokenUsage.inputTokens;
                metrics.agentBreakdown[id].tokenUsage.outputTokens += agentMetrics.tokenUsage.outputTokens;
                
                // Track Google Search usage
                if (agentMetrics.googleSearchUsage) {
                    const currentGoogleUsage = metrics.agentBreakdown[id].googleSearchUsage!;
                    currentGoogleUsage.used = currentGoogleUsage.used || agentMetrics.googleSearchUsage.used;
                    currentGoogleUsage.queriesCount += agentMetrics.googleSearchUsage.queriesCount;
                    currentGoogleUsage.sourcesCount += agentMetrics.googleSearchUsage.sourcesCount;
                    
                    // Merge detailed search data
                    if (agentMetrics.googleSearchUsage.queries) {
                        currentGoogleUsage.queries = [...(currentGoogleUsage.queries || []), ...agentMetrics.googleSearchUsage.queries];
                    }
                    if (agentMetrics.googleSearchUsage.sources) {
                        currentGoogleUsage.sources = [...(currentGoogleUsage.sources || []), ...agentMetrics.googleSearchUsage.sources];
                    }
                    if (agentMetrics.googleSearchUsage.rawMetadata) {
                        currentGoogleUsage.rawMetadata = agentMetrics.googleSearchUsage.rawMetadata;
                    }
                    
                    // Update framework-level Google Search summary
                    if (agentMetrics.googleSearchUsage.used) {
                        metrics.googleSearchSummary.totalUsageCount += 1;
                        metrics.googleSearchSummary.totalQueries += agentMetrics.googleSearchUsage.queriesCount;
                        metrics.googleSearchSummary.totalSources += agentMetrics.googleSearchUsage.sourcesCount;
                        if (!metrics.googleSearchSummary.agentsUsed.includes(id)) {
                            metrics.googleSearchSummary.agentsUsed.push(id);
                        }
                    }
                }
                
                metrics.totalInputTokens += agentMetrics.tokenUsage.inputTokens;
                metrics.totalOutputTokens += agentMetrics.tokenUsage.outputTokens;
                
                const message: UserChatMessage = {
                    type: 'agent',
                    agentId: id,
                    agentName: agentConfig.name.split(':')[1]?.trim() || agentConfig.name,
                    message: content
                };
                discussionHistory.push(message);
                setDiscussionMessages(prev => [...prev, message]);
                await new Promise(r => setTimeout(r, 200));
            }
        }

        console.log(`✅ Iteration ${iterationNumber} - Phase 3 completed`);
        setIsDiscussionLoading(false);

        // --- Phase 4: Final Decision (Single Evaluation for this iteration) ---
        const finalAgentId = 'final_decision_agent';
        const finalAgentConfig = configsForRun[finalAgentId];
        const discussionTranscriptText = discussionHistory.map(m => `${m.agentName}: ${m.message}`).join("\n\n");
        let basePrompt = finalAgentConfig.prompt.replace('{expert_discussion_transcript}', discussionTranscriptText);
        
        console.log(`🎯 Starting iteration ${iterationNumber} - Phase 4: Final Decision`);
        
        // Add iteration-specific variation to encourage true independence
        let finalPrompt = basePrompt + `\n\n**Independent Assessment #${iterationNumber}**: Provide your fresh, independent evaluation without being influenced by any previous assessments.`;
        finalPrompt = truncatePromptIfNeeded(finalPrompt);
        
        const { result: evaluationContent, metrics: evalMetrics } = await runAgent(finalAgentId, configsForRun, finalPrompt, false, frameworkConfig.seed, frameworkConfig.temperature);
        
        // Track final agent metrics
        if (!metrics.agentBreakdown[finalAgentId]) {
            metrics.agentBreakdown[finalAgentId] = { duration: 0, tokenUsage: { inputTokens: 0, outputTokens: 0 } };
        }
        metrics.agentBreakdown[finalAgentId].duration += evalMetrics.duration;
        metrics.agentBreakdown[finalAgentId].tokenUsage.inputTokens += evalMetrics.tokenUsage.inputTokens;
        metrics.agentBreakdown[finalAgentId].tokenUsage.outputTokens += evalMetrics.tokenUsage.outputTokens;
        metrics.totalInputTokens += evalMetrics.tokenUsage.inputTokens;
        metrics.totalOutputTokens += evalMetrics.tokenUsage.outputTokens;
        
        // Parse and return the evaluation result
        try {
            const parsedEval = JSON.parse(evaluationContent);
            console.log(`✅ Iteration ${iterationNumber} - Phase 4 completed with score: ${parsedEval.feasibilityScore}/100`);
            
            return {
                discussionHistory,
                evaluationResult: {
                    iteration: iterationNumber,
                    feasibilityScore: parsedEval.feasibilityScore,
                    rationale: parsedEval.rationale,
                    keyFactors: parsedEval.keyFactors || []
                }
            };
        } catch (e) {
            console.error(`❌ Iteration ${iterationNumber} - Failed to parse evaluation:`, e);
            
            return {
                discussionHistory,
                evaluationResult: {
                    iteration: iterationNumber,
                    feasibilityScore: 50, // neutral score for failed parsing
                    rationale: `Evaluation ${iterationNumber} failed to parse: ${e instanceof Error ? e.message : 'Unknown error'}`,
                    keyFactors: ['Parsing error occurred']
                }
            };
        }
    }, [frameworkConfig]);

    const runDiscussionAndDecision = useCallback(async (context: string, configsForRun: Record<string, AgentConfig>, metrics: FrameworkMetrics, googleSearchEnabled: boolean = false) => {
        // Reset discussion-related states
        setDiscussionMessages([]);
        setIsDiscussionLoading(true);
        setFinalDecision({ ...initialFinalDecision, agentName: configsForRun.final_decision_agent.name });
        setExpertOpinions([]);

        const numberOfIterations = frameworkConfig.iterations;
        const independentEvaluations = [];
        const allIterationsDialogue: { iteration: number, discussionHistory: UserChatMessage[] }[] = [];
        let lastDiscussionHistory: UserChatMessage[] = [];

        console.log(`🚀 Starting ${numberOfIterations} complete iterations (Phase 3 + Phase 4 each time)`);

        // Run multiple complete iterations (Phase 3 + Phase 4 for each)
        for (let i = 1; i <= numberOfIterations; i++) {
            console.log(`\n🔄 === Starting Complete Iteration ${i}/${numberOfIterations} ===`);
            
            // Update progress display
            setFinalDecision({ 
                id: 'final_decision_agent', 
                agentName: configsForRun.final_decision_agent.name, 
                content: `Progress: Running complete iteration ${i}/${numberOfIterations} (Expert Discussion + Decision)...`, 
                isLoading: true 
            });

            // Reset discussion messages and set loading state for fresh iteration
            setDiscussionMessages([]);
            setIsDiscussionLoading(true);
            
            const { discussionHistory, evaluationResult } = await runSingleIteration(context, configsForRun, metrics, googleSearchEnabled, i);
            
            // Store the evaluation result with discussion history
            independentEvaluations.push({
                ...evaluationResult,
                discussionHistory: [...discussionHistory]
            });

            // Store all iterations dialogue
            allIterationsDialogue.push({
                iteration: i,
                discussionHistory: [...discussionHistory]
            });

            // Keep the last iteration's discussion for final display
            if (i === numberOfIterations) {
                lastDiscussionHistory = discussionHistory;
                setDiscussionMessages(discussionHistory);
            }

            console.log(`✅ Complete Iteration ${i}/${numberOfIterations} finished - Score: ${evaluationResult.feasibilityScore}/100`);
        }

        setIsDiscussionLoading(false);
        console.log(`\n🎯 All ${numberOfIterations} iterations completed!`);

        // Process the aggregated results from all iterations
        const finalAgentId = 'final_decision_agent';
        const finalAgentConfig = configsForRun[finalAgentId];
        
        try {
            // Calculate statistics from all evaluations
            const scores = independentEvaluations.map((iter: any) => iter.feasibilityScore);
            const mean = scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length;
            const sortedScores = [...scores].sort((a: number, b: number) => a - b);
            const mid = Math.floor(sortedScores.length / 2);
            const median = sortedScores.length % 2 === 0 
                ? (sortedScores[mid - 1] + sortedScores[mid]) / 2
                : sortedScores[mid];
            const variance = scores.reduce((sum: number, score: number) => sum + Math.pow(score - mean, 2), 0) / scores.length;
            const standardDeviation = Math.sqrt(variance);
            
            // Calculate confidence level mathematically
            let confidenceLevel = 'Low';
            if (standardDeviation <= 5) confidenceLevel = 'High';
            else if (standardDeviation <= 15) confidenceLevel = 'Medium';
            
            // Determine final decision based on median score
            let decision = 'Do not proceed';
            if (median >= 70) decision = 'Proceed';
            else if (median >= 50) decision = 'Proceed with Caution';
            
            // Create final aggregated result
            const finalResult = {
                decision,
                medianScore: median,
                justification: `Based on the median assessment score of ${median.toFixed(1)}/100 with ${confidenceLevel.toLowerCase()} confidence (standard deviation: ${standardDeviation.toFixed(1)}), this proposal is recommended to ${decision.toLowerCase()}.`,
                iterations: independentEvaluations,
                statistics: {
                    mean,
                    median,
                    standardDeviation,
                    confidenceLevel
                }
            };
            
            console.log(`📈 Final Results - Scores: ${scores.join(', ')}, Median: ${median.toFixed(1)}, Decision: ${decision}`);
            
            // Convert feasibility data to expert opinions format for compatibility
            const feasibilityOpinions = independentEvaluations.map((iteration: any) => ({
                name: `Feasibility Assessment ${iteration.iteration}`,
                summary: iteration.rationale,
                feasibilityScore: iteration.feasibilityScore,
                discussionHistory: iteration.discussionHistory || [],
                iteration: iteration.iteration,
                timestamp: new Date().toISOString()
            }));
            setExpertOpinions(feasibilityOpinions);
            
            // Update final decision content with calculated statistics
            setFinalDecision({ 
                id: finalAgentId, 
                agentName: finalAgentConfig.name, 
                content: JSON.stringify(finalResult), 
                isLoading: false 
            });
            
        } catch (e) {
            console.error("Failed to process independent evaluations:", e);
            setFinalDecision({ 
                id: finalAgentId, 
                agentName: finalAgentConfig.name, 
                content: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`, 
                isLoading: false 
            });
        }

        return metrics;
    }, [runSingleIteration,frameworkConfig]);

    const runSimulation = useCallback(async (currentProposal: ProposalData) => {
        if (!originalAgentConfigs) return;
        setIsSimulating(true);
        resetState();

        const configsForRun = originalAgentConfigs;
        
        // Initialize performance tracking
        const startTime = performance.now();
        const metrics: FrameworkMetrics = {
            totalDuration: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            agentBreakdown: {},
            googleSearchSummary: {
                totalUsageCount: 0,
                totalQueries: 0,
                totalSources: 0,
                agentsUsed: []
            }
        };

        // --- Phase 1: Initial Analysis ---
        const classificationConfig = configsForRun['proposal_classification_agent'];
        let classPrompt = classificationConfig.prompt.replace('{proposal_info}', currentProposal.proposal_info);
        classPrompt = truncatePromptIfNeeded(classPrompt);
        const classificationPromise = runAgent('proposal_classification_agent', configsForRun, classPrompt, false, frameworkConfig.seed, frameworkConfig.temperature);

        const summarizeAgentId = 'proposal_information_summarize_agent';
        let summaryResult = { result: '', metrics: { duration: 0, tokenUsage: { inputTokens: 0, outputTokens: 0 } } };
        
        if (currentProposal.url && currentProposal.url.trim() !== '') {
            // URL-based processing with Jina Reader
            try {
                const jinaUrl = `https://r.jina.ai/${currentProposal.url}`;
                setSection1Outputs(prev => ({...prev, [summarizeAgentId]: { ...prev[summarizeAgentId]!, content: 'Fetching proposal content via Jina Reader...', isLoading: true } }));
                
                const response = await fetch(jinaUrl);
                if (!response.ok) throw new Error(`Jina Reader API returned status ${response.status}`);
                const urlContent = await response.text();

                setSection1Outputs(prev => ({...prev, [summarizeAgentId]: { ...prev[summarizeAgentId]!, content: '', isLoading: true } }));
                
                const summarizeConfig = configsForRun[summarizeAgentId];
                let summaryPrompt = summarizeConfig.prompt.replace('{url_content}', urlContent);
                summaryPrompt = truncatePromptIfNeeded(summaryPrompt);
                summaryResult = await runAgent(summarizeAgentId, configsForRun, summaryPrompt, false, frameworkConfig.seed, frameworkConfig.temperature);
            } catch(e: any) {
                console.error("Failed to fetch or summarize URL content:", e);
                summaryResult.result = `Error: Could not retrieve or summarize content from URL. ${e.message}`;
            }
        } else {
            // Plain text processing without URL fetching
            try {
                setSection1Outputs(prev => ({...prev, [summarizeAgentId]: { ...prev[summarizeAgentId]!, content: 'Processing plain text proposal content...', isLoading: true } }));
                
                const summarizeConfig = configsForRun[summarizeAgentId];
                // For plain text, use the proposal_info directly as the content to summarize
                let summaryPrompt = summarizeConfig.prompt.replace('{url_content}', currentProposal.proposal_info);
                summaryPrompt = truncatePromptIfNeeded(summaryPrompt);
                summaryResult = await runAgent(summarizeAgentId, configsForRun, summaryPrompt, false, frameworkConfig.seed, frameworkConfig.temperature);
            } catch(e: any) {
                console.error("Failed to process plain text content:", e);
                summaryResult.result = `Error: Could not process plain text content. ${e.message}`;
            }
        }
        
        const { result: classContent, metrics: classMetrics } = await classificationPromise;
        
        // Track initial analysis metrics
        metrics.agentBreakdown['proposal_classification_agent'] = classMetrics;
        metrics.agentBreakdown[summarizeAgentId] = summaryResult.metrics;
        metrics.totalInputTokens += classMetrics.tokenUsage.inputTokens + summaryResult.metrics.tokenUsage.inputTokens;
        metrics.totalOutputTokens += classMetrics.tokenUsage.outputTokens + summaryResult.metrics.tokenUsage.outputTokens;

        setSection1Outputs(prev => ({ 
            ...prev, 
            proposal_classification_agent: { ...prev.proposal_classification_agent!, content: classContent, isLoading: false } 
        }));

        let summaryForContext = summaryResult.result;
        try {
            const parsed = JSON.parse(summaryResult.result);
            setSection1Outputs(prev => ({...prev, [summarizeAgentId]: { ...prev[summarizeAgentId]!, content: summaryResult.result, data: parsed, isLoading: false } }));
            summaryForContext = JSON.stringify(parsed, null, 2);
        } catch (e) {
            console.error("Failed to parse Summarize agent output, passing raw content to experts.", e);
            setSection1Outputs(prev => ({...prev, [summarizeAgentId]: { ...prev[summarizeAgentId]!, content: `Error: Invalid JSON response. ${summaryResult.result}`, isLoading: false } }));
        }

        // --- Phase 2: Context Building ---
        const fullContext = `
        Proposal: ${currentProposal.proposal_info}
        
        Analysis Context:
        - Classification: ${classContent}
        - URL Content Summary: ${summaryForContext}
        `;
        setInitialContext(fullContext);

        // --- Delegate to run discussion and decision ---
        const finalMetrics = await runDiscussionAndDecision(fullContext, configsForRun, metrics, useGoogleSearch);
        
        // Calculate total duration
        const endTime = performance.now();
        finalMetrics.totalDuration = endTime - startTime;
        setFrameworkMetrics(finalMetrics);

        // --- Phase 5: Framework Performance Tracking ---
        try {
            const trackerAgentId = 'framework_tracker_agent';
            const trackerConfig = configsForRun[trackerAgentId];
            const executionData = JSON.stringify(finalMetrics, null, 2);
            let trackerPrompt = trackerConfig.prompt.replace('{execution_data}', executionData);
            trackerPrompt = truncatePromptIfNeeded(trackerPrompt);
            
            const { result: trackingContent } = await runAgent(trackerAgentId, configsForRun, trackerPrompt, false, frameworkConfig.seed, frameworkConfig.temperature);
            setPerformanceTracking({ 
                id: trackerAgentId, 
                agentName: trackerConfig.name, 
                content: trackingContent, 
                isLoading: false 
            });
        } catch (e) {
            console.error("Failed to run framework tracker:", e);
        }

        setIsSimulating(false);

    }, [resetState, originalAgentConfigs, runDiscussionAndDecision, useGoogleSearch]);
    
    const handleRestartDiscussion = useCallback(async () => {
        if (!initialContext || !agentConfigs) return;
        setIsSimulating(true); // Use master simulating flag to disable other buttons
        
        const metrics: FrameworkMetrics = {
            totalDuration: 0,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            agentBreakdown: {},
            googleSearchSummary: {
                totalUsageCount: 0,
                totalQueries: 0,
                totalSources: 0,
                agentsUsed: []
            }
        };
        
        await runDiscussionAndDecision(initialContext, agentConfigs, metrics, useGoogleSearch);
        setIsSimulating(false);
    }, [initialContext, agentConfigs, runDiscussionAndDecision, useGoogleSearch]);
    
    const downloadJson = (data: object, filename: string) => {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleAskQuestion = useCallback(async (question: string) => {
        if (!agentConfigs || !proposal || !finalDecision?.content || finalDecision.content.startsWith('Error:')) return;
        
        setIsQaLoading(true);
        const userMessage: UserChatMessage = { type: 'user', agentId: 'user', agentName: 'You', message: question };
        setQaMessages(prev => [...prev, userMessage]);

        const buildContext = () => {
            const initialAnalysisContext = Object.values(section1Outputs)
                .map(o => o ? `${(o as any).agentName}:\n${(o as any).data ? JSON.stringify((o as any).data, null, 2) : (o as any).content}` : '')
                .join('\n\n');

            const isUserChatMessage = (message: ChatMessage): message is UserChatMessage => message.type !== 'system';

            const expertDiscussionTranscript = discussionMessages
                .filter(isUserChatMessage)
                .map(m => `${m.agentName}: ${m.message}`).join('\n');
            
            // This now correctly represents only the *previous* Q&A history, before the current question.
            const previousQaHistory = qaMessages
                .filter(isUserChatMessage)
                .map(m => `${m.agentName}: ${m.message}`).join('\n');
            
            return `
            Here is the full context of the original analysis:
            **Original Proposal:**
            ${proposal.proposal_info}

            **Initial Analysis & Summary:**
            ${initialAnalysisContext}

            **Expert Discussion Transcript:**
            ${expertDiscussionTranscript}

            **Final Decision:**
            ${finalDecision.content}
            
            --- PREVIOUS Q&A HISTORY ---
            ${previousQaHistory || 'No Q&A history yet.'}
            `;
        };

        const context = buildContext();
        const expertIds = ['expert_1', 'expert_2', 'expert_3'];
        
        const expertResponses = await Promise.all(expertIds.map(async (id) => {
            const agentConfig = agentConfigs[id];
            // Refined prompt to encourage agents to be explicit about changing their minds.
            let prompt = `${context}\n\n--- NEW QUESTION FROM USER ---\n${question}\n\n--- YOUR TASK ---\nAs ${agentConfig.name}, your core instruction is: "${agentConfig.systemInstruction}".\n\nBased on this instruction and all provided context, formulate your response to the user's question. **If the user's point convinces you or resolves one of your previous concerns, explicitly state that in your response (e.g., 'That's a valid point, my concerns about X are addressed.').** Keep your answer concise and focused on your area of expertise.`;
            prompt = truncatePromptIfNeeded(prompt);
            const isExpertAgent = id.startsWith('expert_');
            const useSearchForQA = useGoogleSearch && isExpertAgent;
            const { result: responseMessage } = await runAgent(id, agentConfigs, prompt, useSearchForQA, frameworkConfig.seed, frameworkConfig.temperature);
            return {
                id,
                name: agentConfig.name,
                response: responseMessage
            };
        }));
        
        const expertMessages: UserChatMessage[] = expertResponses.map(r => ({
            type: 'agent',
            agentId: r.id,
            agentName: r.name.split(':')[1]?.trim() || r.name,
            message: r.response
        }));
        setQaMessages(prev => [...prev, ...expertMessages]);

        for (const expertResponse of expertResponses) {
            const updateAgentConfig = agentConfigs['prompt_update_agent'];
            const expertId = expertResponse.id;
            const expertConfig = agentConfigs[expertId];

            let prompt = updateAgentConfig.prompt
                .replace('{expert_instruction}', expertConfig.systemInstruction || '')
                .replace('{user_question}', question)
                .replace('{expert_response}', expertResponse.response);
            
            prompt = truncatePromptIfNeeded(prompt);
            const { result: updateResultStr } = await runAgent('prompt_update_agent', agentConfigs, prompt, false, frameworkConfig.seed, frameworkConfig.temperature);
            
            try {
                const updateResult = JSON.parse(updateResultStr);
                if (updateResult.update === true && updateResult.newInstruction) {
                    const expertName = expertConfig.name.split(':')[1]?.trim() || expertConfig.name;
                    
                    // Per user request, commenting out automatic download of previous prompt.
                    /*
                    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
                    const filename = `previous_prompt_${expertId}_${timestamp}.json`;
                    const dataToSave = {
                        agentId: expertId,
                        agentName: expertConfig.name,
                        savedAt: new Date().toISOString(),
                        previousInstruction: expertConfig.systemInstruction,
                    };
                    downloadJson(dataToSave, filename);
                    */
                    
                    console.log(`Updating instruction for ${expertName}. Old instruction: "${expertConfig.systemInstruction}" New instruction: "${updateResult.newInstruction}"`);

                    setAgentConfigs(prev => ({
                        ...prev!,
                        [expertId]: { ...prev![expertId], systemInstruction: updateResult.newInstruction }
                    }));

                    const systemMessage: SystemChatMessage = {
                        type: 'system',
                        message: `Perspective updated for ${expertName}. A restart of the discussion will use this new perspective.`
                    };
                    setQaMessages(prev => [...prev, systemMessage]);
                }
            } catch (e) {
                console.error(`Failed to parse or process prompt update for ${expertResponse.name}. Raw response:`, updateResultStr, "Error:", e);
            }
        }

        setIsQaLoading(false);

    }, [agentConfigs, proposal, section1Outputs, discussionMessages, finalDecision, qaMessages, useGoogleSearch]);
    
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await fetch('/agent_config.json');
                const configData = await response.json();
                
                // Extract framework config if it exists
                if (configData.framework_config) {
                    setFrameworkConfig(configData.framework_config);
                    // Remove framework_config from agent configs
                    const { framework_config, ...agentConfigs } = configData;
                    setOriginalAgentConfigs(agentConfigs);
                    setAgentConfigs(agentConfigs);
                } else {
                    setOriginalAgentConfigs(configData);
                    setAgentConfigs(configData);
                }
            } catch (error) {
                console.error("Failed to load agent configuration:", error);
            }
        };

        fetchConfig();
    }, []);

    const handleProposalLoad = (proposalData: ProposalData) => {
        setProposal(proposalData);
        runSimulation(proposalData);
    };
    
    const handleSave = async () => {
        if (!proposal || !finalDecision || !agentConfigs) {
            alert("No proposal has been analyzed or config is missing.");
            return;
        }
        setIsSaving(true);
        try {
            await generatePdf({
                proposal,
                section1Outputs,
                discussionMessages,
                finalDecision,
                expertOpinions,
                agentConfigs,
                frameworkConfig,
                frameworkMetrics,
            });
            alert('Results PDF has been generated and downloaded.');
        } catch (error) {
            console.error("Failed to generate PDF:", error);
            alert("An error occurred while generating the PDF. Please check the console for details.");
        } finally {
            setIsSaving(false);
        }
    }

    const renderFinalDecision = () => {
        if (finalDecision?.isLoading) {
             return (
                 <div className="flex items-center justify-center h-full py-8">
                    <div className="flex flex-col items-center space-y-2">
                        <LoadingSpinner />
                        <span className="text-slate-400 italic">
                            {finalDecision.content.startsWith('Progress:') 
                                ? finalDecision.content 
                                : 'Running feasibility scoring analysis...'
                            }
                        </span>
                    </div>
                </div>
            );
        }
        
        if (!finalDecision?.content || finalDecision.content.startsWith('Error:')) {
            return <p className="text-red-400 p-4">Error generating feasibility analysis. Check console for details.</p>;
        }

        try {
            const parsed = JSON.parse(finalDecision.content);
            console.log('🎯 Final Decision Parsed Data:', parsed);
            
            if (parsed.statistics && parsed.iterations) {
                const medianScore = Math.round(parsed.statistics.median);
                
                // Determine recommendation based on median score
                let recommendation = '';
                let recommendationColor = '';
                let recommendationBg = '';
                
                if (medianScore > 80) {
                    recommendation = 'Proceed';
                    recommendationColor = 'text-green-300';
                    recommendationBg = 'bg-green-900/50';
                } else if (medianScore >= 50) {
                    recommendation = 'Proceed with Caution';
                    recommendationColor = 'text-yellow-300';
                    recommendationBg = 'bg-yellow-900/50';
                } else if (medianScore >= 30) {
                    recommendation = 'Not Recommended';
                    recommendationColor = 'text-orange-300';
                    recommendationBg = 'bg-orange-900/50';
                } else {
                    recommendation = 'Do Not Proceed';
                    recommendationColor = 'text-red-300';
                    recommendationBg = 'bg-red-900/50';
                }
                
                return (
                    <div className="space-y-4">
                        {/* Final Recommendation */}
                        <div className={`text-center p-4 rounded-lg border ${recommendationBg} border-opacity-50`}>
                            <p className={`text-3xl font-bold ${recommendationColor} mb-2`}>{recommendation}</p>
                            <p className="text-slate-300 text-lg">Median Feasibility Score: {medianScore}/100</p>
                            <p className="text-slate-400 text-sm mt-1">
                                Confidence: {parsed.statistics.confidenceLevel} (σ = {parsed.statistics.standardDeviation.toFixed(1)})
                            </p>
                        </div>
                        
                        {/* Score Details */}
                        <div className="text-center text-sm text-slate-400">
                            <p>Based on {parsed.iterations.length} independent evaluations</p>
                            <p>Score range: {Math.min(...parsed.iterations.map((i: any) => i.feasibilityScore))} - {Math.max(...parsed.iterations.map((i: any) => i.feasibilityScore))}</p>
                        </div>
                        
                        {/* Sample Evaluations */}
                        <div className="max-h-32 overflow-y-auto">
                            <p className="text-xs text-slate-400 mb-2">Sample Evaluations:</p>
                            {parsed.iterations.slice(0, 3).map((iter: any) => (
                                <div key={iter.iteration} className="text-xs text-slate-500 mb-1">
                                    #{iter.iteration}: {iter.feasibilityScore}/100 - {iter.rationale.slice(0, 60)}...
                                </div>
                            ))}
                            {parsed.iterations.length > 3 && (
                                <p className="text-xs text-slate-600 italic">...and {parsed.iterations.length - 3} more evaluations</p>
                            )}
                        </div>
                    </div>
                );
            }
            
            // Fallback for missing statistics
            return (
                <div className="space-y-2">
                    <p className="text-2xl font-bold text-center text-sky-300">Analysis Complete</p>
                    <p className="text-slate-400 text-center">Feasibility scoring completed</p>
                    <pre className="text-xs text-slate-500 mt-2">{JSON.stringify(parsed, null, 2).slice(0, 200)}...</pre>
                </div>
            );
        } catch (e) {
            console.error('🚨 Error parsing final decision:', e);
            console.log('🔍 Raw content:', finalDecision.content);
            return (
                <div className="space-y-2">
                    <p className="text-red-400 p-4">Error parsing feasibility analysis JSON</p>
                    <details className="text-xs">
                        <summary className="text-slate-400 cursor-pointer">Show raw content</summary>
                        <pre className="whitespace-pre-wrap text-slate-500 mt-2 max-h-32 overflow-y-auto">{finalDecision.content}</pre>
                    </details>
                </div>
            );
        }
    };

    const renderPerformanceMetrics = () => {
        if (!frameworkMetrics && !performanceTracking) return null;

        return (
            <div className="bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 p-4">
                <div className="flex items-center space-x-3 mb-4">
                    <CPUChipIcon className="w-6 h-6 text-green-400" />
                    <h3 className="font-bold text-lg text-slate-200">Performance Metrics</h3>
                </div>
                {frameworkMetrics && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="flex items-center space-x-2 mb-2">
                                <ClockIcon className="w-4 h-4 text-blue-400" />
                                <span className="text-slate-300 font-medium">Duration</span>
                            </div>
                            <p className="text-slate-400">{(frameworkMetrics.totalDuration / 1000).toFixed(2)}s</p>
                        </div>
                        <div>
                            <div className="flex items-center space-x-2 mb-2">
                                <CPUChipIcon className="w-4 h-4 text-purple-400" />
                                <span className="text-slate-300 font-medium">Tokens</span>
                            </div>
                            <p className="text-slate-400">
                                {frameworkMetrics.totalInputTokens + frameworkMetrics.totalOutputTokens} total
                            </p>
                            <p className="text-xs text-slate-500">
                                {frameworkMetrics.totalInputTokens} in / {frameworkMetrics.totalOutputTokens} out
                            </p>
                        </div>
                    </div>
                )}
                {performanceTracking && !performanceTracking.content.startsWith('Error:') && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                        <p className="text-xs text-slate-400">Detailed analysis available</p>
                    </div>
                )}
            </div>
        );
    };
    
    if (!agentConfigs) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex justify-center items-center">
                <div className="flex flex-col items-center space-y-2">
                    <LoadingSpinner />
                    <span className="text-slate-400 italic">Loading agent configuration...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-4 lg:p-8 selection:bg-sky-500 selection:text-white">
            <div className="max-w-screen-2xl mx-auto">
                <header className="mb-6">
                    <div className="flex justify-between items-center mb-4">
                         <div>
                            <h1 className="text-2xl lg:text-3xl font-bold text-slate-100">AI Multi-Agent Decision Framework</h1>
                            <p className="text-slate-400">Visualizing collaborative AI analysis and decision-making</p>
                        </div>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving || isSimulating || !proposal}
                            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 transition-all duration-300 text-white font-semibold py-2 px-4 rounded-lg shadow-md disabled:cursor-not-allowed">
                            {isSaving ? <LoadingSpinner/> : <SaveIcon className="w-5 h-5"/>}
                            <span>{isSaving ? 'Saving...' : 'Save Results'}</span>
                        </button>
                    </div>
                    <ProposalInput 
                onProposalLoad={handleProposalLoad} 
                isSimulating={isSimulating}
                useGoogleSearch={useGoogleSearch}
                onGoogleSearchToggle={setUseGoogleSearch}
                useGeminiPro={useGeminiPro}
                onGeminiProToggle={setUseGeminiPro}
            />
                </header>

                 <div className="flex border-b border-slate-700 mb-6">
                    <button 
                        onClick={() => setActiveTab('simulation')} 
                        className={`flex items-center space-x-2 py-2 px-4 text-sm font-medium rounded-t-lg transition-colors duration-200 ${activeTab === 'simulation' ? 'bg-slate-800/50 border-b-2 border-sky-400 text-sky-300' : 'text-slate-400 hover:bg-slate-800/20'}`}
                        aria-current={activeTab === 'simulation' ? 'page' : undefined}
                    >
                        <TestTubeDiagonalIcon className="w-5 h-5"/>
                        <span>Simulation</span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('qa')} 
                        disabled={!proposal || isSimulating}
                        className={`flex items-center space-x-2 py-2 px-4 text-sm font-medium rounded-t-lg transition-colors duration-200 disabled:cursor-not-allowed disabled:text-slate-600 ${activeTab === 'qa' ? 'bg-slate-800/50 border-b-2 border-sky-400 text-sky-300' : 'text-slate-400 hover:bg-slate-800/20'}`}
                        aria-current={activeTab === 'qa' ? 'page' : undefined}
                    >
                        <MessageSquareIcon className="w-5 h-5"/>
                        <span>Q&A with Experts</span>
                    </button>
                </div>

                {activeTab === 'simulation' && (
                    <>
                        {!proposal ? (
                            <div className="text-center py-20 bg-slate-800/20 rounded-lg border-2 border-dashed border-slate-700">
                                <BotIcon className="w-16 h-16 mx-auto text-slate-600" />
                                <h2 className="mt-4 text-xl font-semibold text-slate-400">Awaiting Proposal</h2>
                                <p className="mt-2 text-slate-500">Upload a proposal JSON file or use the sample to start the simulation.</p>
                            </div>
                        ) : (
                            <main className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:items-start">
                                <section className="col-span-1 flex flex-col gap-6">
                                    {Object.values(section1Outputs).map(output => (
                                        <AgentOutputCard key={(output as any)!.id} title={agentConfigs![(output as any)!.id].name} output={output} />
                                    ))}
                                </section>

                                <section className="col-span-1 lg:col-span-2 flex flex-col gap-6">
                                    <DiscussionPanel 
                                        messages={discussionMessages} 
                                        isLoading={isDiscussionLoading} 
                                        onRestart={handleRestartDiscussion}
                                        hasSimulationRun={!!proposal && !isSimulating}
                                    />
                                    <div className="bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 flex flex-col">
                                        <div className="p-4 border-b border-slate-700 flex items-center space-x-3">
                                            <BrainCircuitIcon className="w-6 h-6 text-purple-400" />
                                            <h3 className="font-bold text-lg text-slate-200">{finalDecision?.agentName}</h3>
                                        </div>
                                        <div className="p-4 text-slate-300">
                                            {renderFinalDecision()}
                                        </div>
                                    </div>
                                </section>
                                
                                <section className="col-span-1 flex flex-col gap-6">
                                    <SummaryPanel 
                                        initialAnalysis={Object.values(section1Outputs)}
                                        expertOpinions={expertOpinions}
                                        finalDecision={finalDecision}
                                    />
                                    {renderPerformanceMetrics()}
                                </section>
                            </main>
                        )}
                    </>
                )}

                {activeTab === 'qa' && (
                    <QAPanel 
                        expertOpinions={expertOpinions}
                        finalDecision={finalDecision}
                        messages={qaMessages}
                        isLoading={isQaLoading}
                        onAskQuestion={handleAskQuestion}
                        hasSimulationRun={!!proposal}
                    />
                )}
            </div>
        </div>
    );
};

export default App;