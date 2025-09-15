import React, { useState, useCallback, useRef } from 'react';
import { ProposalData } from '../types';
import { UploadIcon, LoadingSpinner } from './icons';

interface ProposalInputProps {
    onProposalLoad: (proposal: ProposalData) => void;
    isSimulating: boolean;
    useGoogleSearch?: boolean;
    onGoogleSearchToggle?: (enabled: boolean) => void;
    useGeminiPro?: boolean;
    onGeminiProToggle?: (enabled: boolean) => void;
}

const sampleProposal: ProposalData = {
    proposal_info: "Proposal to Implement an LLM-based System for Initial Community Idea Delegation and Feedback Consolidation. The system would use a large language model to analyze new community ideas, categorize them, summarize key points, and route them to the appropriate special interest group or committee. This aims to streamline the initial stages of governance by providing structured feedback and reducing manual overhead for core contributors.",
    date: "2024-07-26",
    url: "https://gov.optimism.io/t/a-retrospective-on-temp-checks/7946"
};


const ProposalInput: React.FC<ProposalInputProps> = ({ onProposalLoad, isSimulating, useGoogleSearch = false, onGoogleSearchToggle, useGeminiPro = false, onGeminiProToggle }) => {
    const [proposal, setProposal] = useState<ProposalData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasUrlStructure, setHasUrlStructure] = useState<boolean>(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);

                if (hasUrlStructure) {
                    // Expect full structure with URL
                    if (data.proposal_info && data.date && data.url) {
                        setProposal(data);
                        onProposalLoad(data);
                    } else {
                        throw new Error("JSON file is missing required fields: 'proposal_info', 'date', 'url'.");
                    }
                } else {
                    // Treat JSON as plain text content
                    const plainTextProposal: ProposalData = {
                        proposal_info: JSON.stringify(data, null, 2), // Use entire JSON as text content
                        date: new Date().toISOString().split('T')[0], // Today's date
                        url: "" // Empty URL for plain text processing
                    };
                    setProposal(plainTextProposal);
                    onProposalLoad(plainTextProposal);
                }
            } catch (err: any) {
                setError(`Error parsing file: ${err.message}`);
                setProposal(null);
            } finally {
                // Reset file input to allow re-uploading the same file
                if (event.target) {
                    event.target.value = '';
                }
            }
        };
        reader.onerror = () => {
             setError('Failed to read file.');
             setProposal(null);
        }
        reader.readAsText(file);
    }, [onProposalLoad, hasUrlStructure]);

    const handleSampleLoad = useCallback(() => {
        setError(null);
        setProposal(sampleProposal);
        onProposalLoad(sampleProposal);
    }, [onProposalLoad]);


    
    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const shortenText = (text: string, maxLength: number = 120): string => {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength).trim() + '...';
    };

    return (
        <div className="bg-slate-800/30 rounded-lg p-4 mb-6 border border-slate-700/50">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                 <div className="flex-1 text-center md:text-left min-w-0">
                 {!proposal && !error && <p className="text-slate-400">Upload a proposal JSON file or use the sample to begin.</p>}
                 {error && <p className="text-red-400">{error}</p>}
                 {proposal && (
                        <div className="space-y-2">
                             <p className="font-semibold text-slate-200" title={proposal.proposal_info}>
                                <span className="text-sky-400">Proposal:</span> {shortenText(proposal.proposal_info)}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-slate-400">
                               <span>Date: {proposal.date}</span>
                                <a href={proposal.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 hover:underline">
                                    Source Link
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    className="hidden"
                    disabled={isSimulating}
                />
                 <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto flex-shrink-0">
                     <div className="flex items-center gap-2 text-sm text-slate-300">
                         <span>Has URL:</span>
                         <button
                             onClick={() => setHasUrlStructure(!hasUrlStructure)}
                             disabled={isSimulating}
                             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                 hasUrlStructure ? 'bg-emerald-600' : 'bg-slate-600'
                             } disabled:opacity-50`}
                         >
                             <span
                                 className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                     hasUrlStructure ? 'translate-x-6' : 'translate-x-1'
                                 }`}
                             />
                         </button>
                         <span className="text-xs text-slate-400">
                             {hasUrlStructure ? 'Jina' : 'Text'}
                         </span>
                     </div>
                     <div className="flex items-center gap-2 text-sm text-slate-300">
                         <span>Google Search:</span>
                         <button
                             onClick={() => onGoogleSearchToggle?.(!useGoogleSearch)}
                             disabled={isSimulating}
                             className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                 useGoogleSearch ? 'bg-blue-600' : 'bg-slate-600'
                             } disabled:opacity-50`}
                         >
                             <span
                                 className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                     useGoogleSearch ? 'translate-x-6' : 'translate-x-1'
                                 }`}
                             />
                         </button>
                         <span className="text-xs text-slate-400">
                         {useGoogleSearch ? 'Enabled' : 'Disabled'}
                         </span>
                         </div>
                             <div className="flex items-center gap-2 text-sm text-slate-300">
                          <span>Gemini Pro:</span>
                          <button
                              onClick={() => onGeminiProToggle?.(!useGeminiPro)}
                              disabled={isSimulating}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  useGeminiPro ? 'bg-purple-600' : 'bg-slate-600'
                              } disabled:opacity-50`}
                          >
                              <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                      useGeminiPro ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                              />
                          </button>
                          <span className="text-xs text-slate-400">
                              {useGeminiPro ? 'Pro' : 'Flash'}
                          </span>
                      </div>
                  <button
                 onClick={handleSampleLoad}
                 disabled={isSimulating}
                 className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 transition-all duration-300 text-white font-semibold py-2 px-4 rounded-lg shadow-md disabled:cursor-not-allowed"
                 >
                 <span>Use Sample</span>
                 </button>
                 <button
                 onClick={handleButtonClick}
                     disabled={isSimulating}
                         className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-600 transition-all duration-300 text-white font-semibold py-2 px-4 rounded-lg shadow-md disabled:cursor-not-allowed"
                     >
                         {isSimulating ? (
                             <>
                                 <LoadingSpinner />
                                 <span>Simulating...</span>
                             </>
                         ) : (
                             <>
                                 <UploadIcon className="w-5 h-5" />
                                 <span>{proposal ? 'Upload New' : 'Upload Proposal'}</span>
                             </>
                         )}
                     </button>
                 </div>
            </div>
        </div>
    );
};

export default ProposalInput;