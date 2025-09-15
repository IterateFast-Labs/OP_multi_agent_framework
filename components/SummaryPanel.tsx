
import React, { useState } from 'react';
import { ExpertOpinion, AgentOutput } from '../types';
import SummaryChart from './SummaryChart';
import { BrainCircuitIcon, ChevronDownIcon } from './icons';

// Mathematical utility functions
const calculateMedian = (scores: number[]): number => {
    if (scores.length === 0) return 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
};

const calculateConfidenceLevel = (scores: number[]): string => {
    if (scores.length === 0) return 'Low';
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Confidence based on standard deviation thresholds
    if (standardDeviation <= 5) return 'High';
    if (standardDeviation <= 15) return 'Medium';
    return 'Low';
};

interface SummaryPanelProps {
    initialAnalysis: (AgentOutput | null)[];
    expertOpinions: ExpertOpinion[];
    finalDecision: AgentOutput | null;
}

const SummaryPanel: React.FC<SummaryPanelProps> = ({ initialAnalysis, expertOpinions, finalDecision }) => {
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(true);
    const [isOpinionsOpen, setIsOpinionsOpen] = useState(true);

    const renderFinalDecisionContent = () => {
        if (finalDecision?.isLoading) {
            return { decision: '...', justification: 'Synthesizing...' };
        }
        if (!finalDecision?.content || finalDecision.content.startsWith('Error:')) {
            return { decision: 'Error', justification: 'Failed to generate a decision.' };
        }
        try {
            return JSON.parse(finalDecision.content);
        } catch (e) {
            console.error("Failed to parse final decision in SummaryPanel:", e);
            return { decision: 'Error', justification: 'Failed to parse decision JSON.' };
        }
    };

    const getInitialAnalysisSummary = (output: AgentOutput) => {
        let summaryText = '...';
        if (output.data?.reasoning) {
            summaryText = output.data.reasoning;
        } else if (output.content) {
            summaryText = output.content.split('.')[0] + '.';
        }
        return (
            <li key={output.id}><span className="font-medium text-slate-300">{output.agentName.replace(' Agent', '')}:</span> {summaryText}</li>
        )
    }

    const finalDecisionData = renderFinalDecisionContent();

    return (
        <div className="bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 flex flex-col">
            <div className="flex items-center space-x-3 p-4">
                <BrainCircuitIcon className="w-7 h-7 text-purple-400" />
                <h3 className="font-bold text-xl text-slate-200">Executive Summary</h3>
            </div>
            
            <div id="executive-summary-content" className="p-4 pt-0 space-y-6">

                <div className="space-y-2">
                    <button
                        type="button"
                        aria-expanded={isAnalysisOpen}
                        aria-controls="initial-analysis-content"
                        onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
                        className="flex items-center justify-between w-full text-left border-b border-slate-700 pb-1"
                    >
                        <h4 className="font-semibold text-slate-300">Initial Analysis</h4>
                        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transform transition-transform duration-300 ${isAnalysisOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isAnalysisOpen && (
                        <div id="initial-analysis-content" className="pt-2">
                             <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                                {initialAnalysis.map(output => output && !output.isLoading && getInitialAnalysisSummary(output))}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <h4 className="font-semibold text-slate-300 border-b border-slate-700 pb-1">Iteration Scores</h4>
                    {expertOpinions.length > 0 ? (
                        <div className="bg-slate-900/50 p-3 rounded-md">
                            <div className="text-center mb-3">
                                <p className="text-2xl font-bold text-sky-300">
                                    {Math.round(calculateMedian(expertOpinions.map(o => o.feasibilityScore)))}/100
                                </p>
                                <p className="text-xs text-slate-400">
                                    Median Score | Confidence: {calculateConfidenceLevel(expertOpinions.map(o => o.feasibilityScore))}
                                </p>
                            </div>
                            <SummaryChart data={expertOpinions} />
                        </div>
                    ) : (
                        <div className="text-center text-slate-400 py-4">Awaiting feasibility analysis...</div>
                    )}
                </div>

                <div className="space-y-2">
                    <button
                        type="button"
                        aria-expanded={isOpinionsOpen}
                        aria-controls="expert-opinions-content"
                        onClick={() => setIsOpinionsOpen(!isOpinionsOpen)}
                        className="flex items-center justify-between w-full text-left border-b border-slate-700 pb-1"
                    >
                        <h4 className="font-semibold text-slate-300">Representative Assessment</h4>
                        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transform transition-transform duration-300 ${isOpinionsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpinionsOpen && (
                        <div id="expert-opinions-content" className="pt-2 text-sm">
                            {expertOpinions.length > 0 ? (
                                <div>
                                    <p className="font-bold text-sky-400">Median Assessment</p>
                                    <p className="text-slate-300 mt-1">
                                        {(() => {
                                            const scores = expertOpinions.map(o => o.feasibilityScore);
                                            const medianScore = calculateMedian(scores);
                                            const medianIndex = expertOpinions.findIndex(o => 
                                                Math.abs(o.feasibilityScore - medianScore) === 
                                                Math.min(...scores.map(s => Math.abs(s - medianScore)))
                                            );
                                            return expertOpinions[medianIndex]?.summary || 'Assessment in progress...';
                                        })()}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-slate-400 italic text-xs">Awaiting feasibility assessment...</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SummaryPanel;
