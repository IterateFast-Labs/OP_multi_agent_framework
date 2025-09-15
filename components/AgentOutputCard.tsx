
import React from 'react';
import { AgentOutput } from '../types';
import { BotIcon, LoadingSpinner } from './icons';

interface AgentOutputCardProps {
  title: string;
  output: AgentOutput | null;
}

const AgentOutputCard: React.FC<AgentOutputCardProps> = ({ title, output }) => {
  const formatContent = (content: string) => {
    // Basic markdown for bold and newlines
    let formattedContent = content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-sky-300">$1</strong>')
      .replace(/\n/g, '<br />');
    return { __html: formattedContent };
  };

  const renderData = (data: Record<string, any>) => {
    return (
      <div className="space-y-4">
        {Object.entries(data).map(([key, value]) => {
          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
          return (
            <div key={key}>
              <h4 className="font-semibold text-sky-400 mb-1">{formattedKey}</h4>
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{content}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const { data, isLoading, content } = output || {};

  return (
    <div className="bg-slate-800/50 rounded-lg shadow-lg backdrop-blur-sm border border-slate-700/50 flex flex-col">
      <div className="p-4 border-b border-slate-700 flex items-center space-x-3">
        <BotIcon className="w-6 h-6 text-sky-400" />
        <h3 className="font-bold text-lg text-slate-200">{title}</h3>
      </div>
      <div className="p-4 text-slate-300 text-sm flex-grow overflow-y-auto max-h-[250px]">
        {isLoading ? (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center space-y-2">
                    <LoadingSpinner />
                    <span className="text-slate-400 italic text-center">
                      {content || "Agent is thinking..."}
                    </span>
                </div>
            </div>
        ) : data ? (
            renderData(data)
        ) : (
          <div dangerouslySetInnerHTML={formatContent(content || "Awaiting execution...")}></div>
        )}
      </div>
    </div>
  );
};

export default AgentOutputCard;
