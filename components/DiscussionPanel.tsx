import React, { useRef, useEffect } from 'react';
import { ChatMessage, UserChatMessage } from '../types';
import { UserIcon, LoadingSpinner, RefreshCwIcon } from './icons';

interface DiscussionPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onRestart: () => void;
  hasSimulationRun: boolean;
}

const getAvatarColor = (agentId: string) => {
    switch(agentId) {
        case 'expert_1': return 'bg-green-500';
        case 'expert_2': return 'bg-blue-500';
        case 'expert_3': return 'bg-red-500';
        default: return 'bg-gray-500';
    }
}

const DiscussionPanel: React.FC<DiscussionPanelProps> = ({ messages, isLoading, onRestart, hasSimulationRun }) => {
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

  return (
    <div className="bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-bold text-lg text-slate-200">Expert Discussion</h3>
        <button
            onClick={onRestart}
            disabled={!hasSimulationRun || isLoading}
            className="flex items-center space-x-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 text-white font-semibold py-1.5 px-3 rounded-lg shadow-md"
            title="Restart discussion with updated expert perspectives"
        >
            <RefreshCwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Restart</span>
        </button>
      </div>
      <div className="p-4 flex-grow overflow-y-auto space-y-4 max-h-[400px]">
        {messages.map((msg, index) => {
           if (msg.type !== 'agent') return null;
           const agentMsg = msg as UserChatMessage;
           return (
              <div key={index} className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${getAvatarColor(agentMsg.agentId)}`}>
                  <UserIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sky-300 text-sm">{agentMsg.agentName}</p>
                  <p className="text-slate-300 text-sm">{agentMsg.message}</p>
                </div>
              </div>
           )
        })}
        {isLoading && (
            <div className="flex items-center space-x-3 text-slate-400 italic">
                <LoadingSpinner/>
                <span>Experts are conferring...</span>
            </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
};

export default DiscussionPanel;
