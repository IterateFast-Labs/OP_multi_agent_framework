import React, { useState, useRef, useEffect } from 'react';
import { AgentOutput, ChatMessage, ExpertOpinion, SystemChatMessage, UserChatMessage } from '../types';
import { BotIcon, BrainCircuitIcon, LoadingSpinner, SendIcon, UserIcon, MessageSquareIcon } from './icons';

interface QAPanelProps {
    expertOpinions: ExpertOpinion[];
    finalDecision: AgentOutput | null;
    messages: ChatMessage[];
    isLoading: boolean;
    onAskQuestion: (question: string) => void;
    hasSimulationRun: boolean;
}

const getAvatarColor = (agentId: string) => {
    switch (agentId) {
        case 'user': return 'bg-sky-500';
        case 'expert_1': return 'bg-green-500'; // Dr. Anya Sharma (Finance)
        case 'expert_2': return 'bg-blue-500'; // Ben Carter (Technology)
        case 'expert_3': return 'bg-red-500'; // Chloe Davis (Governance)
        default: return 'bg-purple-500';
    }
};

const QAPanel: React.FC<QAPanelProps> = ({ expertOpinions, finalDecision, messages, isLoading, onAskQuestion, hasSimulationRun }) => {
    const [question, setQuestion] = useState('');
    const endOfMessagesRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);


    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [question]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (question.trim() && !isLoading) {
            onAskQuestion(question);
            setQuestion('');
        }
    };

    const renderFinalDecisionContent = () => {
        if (!finalDecision?.content || finalDecision.content.startsWith('Error:')) {
            return { decision: 'N/A', justification: 'Decision has not been generated yet.' };
        }
        try {
            return JSON.parse(finalDecision.content);
        } catch (e) {
            return { decision: 'Error', justification: 'Failed to parse decision JSON.' };
        }
    };

    if (!hasSimulationRun) {
        return (
            <div className="text-center py-20 bg-slate-800/20 rounded-lg border-2 border-dashed border-slate-700">
                <BotIcon className="w-16 h-16 mx-auto text-slate-600" />
                <h2 className="mt-4 text-xl font-semibold text-slate-400">Q&A with Experts</h2>
                <p className="mt-2 text-slate-500">Run a simulation on the 'Simulation' tab first to enable this feature.</p>
            </div>
        );
    }
    
    const finalDecisionData = renderFinalDecisionContent();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                 <div className="bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 flex flex-col p-4">
                    <h3 className="font-bold text-lg text-slate-200 border-b border-slate-700 pb-2 mb-3">Context: Final Decision</h3>
                     <div className="bg-slate-900/50 p-3 rounded-md">
                        <p className="text-lg font-bold text-center text-sky-300">{finalDecisionData.decision}</p>
                        <p className="text-sm text-slate-400 mt-2 text-center">{finalDecisionData.justification}</p>
                    </div>
                </div>
                 <div className="bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 flex flex-col p-4">
                    <h3 className="font-bold text-lg text-slate-200 border-b border-slate-700 pb-2 mb-3">Context: Expert Opinions</h3>
                    <div className="text-sm space-y-4">
                        {expertOpinions.length > 0
                            ? expertOpinions.map(opinion => {
                                const name = opinion.name.split(':')[1]?.trim() || opinion.name;
                                return (
                                    <div key={opinion.name}>
                                        <p className="font-bold text-sky-400">{name}</p>
                                        <p className="text-slate-300 mt-1">{opinion.summary}</p>
                                    </div>
                                );
                            })
                            : <p className="text-slate-400 italic text-xs">Awaiting expert opinions...</p>
                        }
                    </div>
                </div>
            </div>

            <div className="lg:col-span-2 bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 flex flex-col h-[70vh]">
                 <div className="p-4 border-b border-slate-700 flex items-center space-x-3">
                    <MessageSquareIcon className="w-6 h-6 text-sky-400" />
                    <h3 className="font-bold text-lg text-slate-200">Ask the Experts</h3>
                </div>
                
                <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                    {messages.map((msg, index) => {
                         if (msg.type === 'system') {
                            const sysMsg = msg as SystemChatMessage;
                            return (
                                <div key={index} className="text-center text-xs text-purple-400 italic py-2">
                                    --- {sysMsg.message} ---
                                </div>
                            )
                         }
                         
                         const userMsg = msg as UserChatMessage;
                         const isUser = userMsg.agentId === 'user';

                         return (
                            <div key={index} className={`flex items-start space-x-3 ${isUser ? 'justify-end' : ''}`}>
                                {!isUser && (
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${getAvatarColor(userMsg.agentId)}`}>
                                        <UserIcon className="w-5 h-5 text-white" />
                                    </div>
                                )}
                                <div className={`flex-1 max-w-xl p-3 rounded-lg ${isUser ? 'bg-sky-800/70' : 'bg-slate-700/50'}`}>
                                    <p className={`font-semibold text-sm mb-1 ${isUser ? 'text-sky-300' : 'text-purple-300'}`}>{userMsg.agentName}</p>
                                    <p className="text-slate-200 text-sm whitespace-pre-wrap">{userMsg.message}</p>
                                </div>
                                {isUser && (
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${getAvatarColor(userMsg.agentId)}`}>
                                        <UserIcon className="w-5 h-5 text-white" />
                                    </div>
                                )}
                            </div>
                         )
                    })}
                    {isLoading && (
                        <div className="flex items-center space-x-3 text-slate-400 italic">
                            <LoadingSpinner/>
                            <span>Experts are formulating responses...</span>
                        </div>
                    )}
                    <div ref={endOfMessagesRef} />
                </div>
                
                <div className="p-4 border-t border-slate-700">
                    <form onSubmit={handleFormSubmit} className="flex items-center space-x-2">
                        <textarea
                            ref={textareaRef}
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleFormSubmit(e);
                                }
                            }}
                            placeholder="Ask a follow-up question..."
                            className="flex-1 bg-slate-900/80 p-2 rounded-lg text-slate-200 focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none max-h-24 overflow-y-auto"
                            rows={1}
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !question.trim()} className="bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 disabled:cursor-not-allowed p-2 rounded-full text-white transition-colors duration-200 self-end">
                           {isLoading ? <LoadingSpinner /> : <SendIcon className="w-5 h-5"/>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default QAPanel;