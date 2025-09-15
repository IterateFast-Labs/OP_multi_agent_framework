
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AgentConfig, AgentOutput, ChatMessage, ExpertOpinion, FrameworkConfig, ProposalData, UserChatMessage } from '../types';
import { runAgentQuery } from '../services/geminiService';

interface GeneratorData {
    proposal: ProposalData;
    section1Outputs: Record<string, AgentOutput | null>;
    discussionMessages: ChatMessage[];
    finalDecision: AgentOutput | null;
    expertOpinions: ExpertOpinion[];
    agentConfigs: Record<string, AgentConfig>;
    frameworkConfig: FrameworkConfig;
    frameworkMetrics?: any;
}

class PdfReportGenerator {
    private doc: jsPDF;
    private y: number;
    private readonly margin: number = 20;
    private readonly pageWidth: number;
    private readonly pageHeight: number;
    private readonly contentWidth: number;
    
    private readonly C_PRIMARY = '#0ea5e9'; // sky-500
    private readonly C_TEXT_DARK = '#1e293b'; // slate-800
    private readonly C_TEXT_LIGHT = '#64748b'; // slate-500
    private readonly C_HEADING = '#0f172a'; // slate-900
    private readonly C_BORDER = '#cbd5e1'; // slate-300

    constructor() {
        this.doc = new jsPDF('p', 'mm', 'a4');
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.contentWidth = this.pageWidth - this.margin * 2;
        this.y = 0;
    }

    private checkPageBreak(heightNeeded: number = 10) {
        if (this.y + heightNeeded > this.pageHeight - this.margin) {
            this.doc.addPage();
            this.y = this.margin;
        }
    }

    private addTitle(text: string) {
        this.y = this.margin + 10;
        this.doc.setFontSize(24);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(this.C_HEADING);
        this.doc.text(text, this.pageWidth / 2, this.y, { align: 'center' });
        this.y += 15;
    }
    
    private addSectionHeader(text: string) {
        this.y += 8;
        this.checkPageBreak(15);
        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(this.C_HEADING);
        this.doc.text(text, this.margin, this.y);
        
        this.doc.setDrawColor(this.C_PRIMARY);
        this.doc.setLineWidth(0.5);
        this.doc.line(this.margin, this.y + 2, this.pageWidth - this.margin, this.y + 2);
        
        this.y += 10;
    }

    private addSubHeader(text: string) {
        this.checkPageBreak(10);
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(this.C_PRIMARY);
        this.doc.text(text, this.margin, this.y);
        this.y += 7;
    }

    private addText(text: string, options: { isMono?: boolean, fontStyle?: 'normal' | 'bold' | 'italic', indent?: number, fontSize?: number } = {}) {
        const { isMono = false, fontStyle = 'normal', indent = 0, fontSize = 10 } = options;
        this.checkPageBreak(10);
        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', isMono ? 'courier' : fontStyle);
        this.doc.setTextColor(this.C_TEXT_DARK);
        
        const lines = this.doc.splitTextToSize(text, this.contentWidth - indent);
        const lineHeight = 5.5; // More readable line height
        
        for(const line of lines) {
            this.checkPageBreak(lineHeight);
            this.doc.text(line, this.margin + indent, this.y);
            this.y += lineHeight;
        }
        this.y += lineHeight / 2; // A little extra space after a block of text
    }

    public async generate(data: GeneratorData) {
        // ---- Title ----
        this.addTitle('AI Multi-Agent Analysis Report');
        this.addSubHeader('Proposal Details');
        this.addText(`Title: ${data.proposal.proposal_info}\nDate: ${data.proposal.date}\nURL: ${data.proposal.url}`);
        
        // ---- Initial Analysis ----
        this.addSectionHeader('1. Initial Analysis');
        const classificationAgent = data.section1Outputs.proposal_classification_agent;
        if(classificationAgent) {
            this.addSubHeader(classificationAgent.agentName);
            this.addText(classificationAgent.content || 'No content available.');
        }

        const summarizeAgent = data.section1Outputs.proposal_information_summarize_agent;
        if(summarizeAgent) {
            this.addSubHeader(summarizeAgent.agentName);
            if (summarizeAgent.data) {
                this.addText("Formatting summary, please wait...", { fontStyle: 'italic' });
                const formatterConfig = data.agentConfigs['pdf_formatter_agent'];
                if (formatterConfig) {
                    const prompt = formatterConfig.prompt.replace('{json_content}', JSON.stringify(summarizeAgent.data, null, 2));
                    const { content: formattedContent, googleSearchMetadata } = await runAgentQuery({ ...formatterConfig, prompt, seed: data.frameworkConfig.seed, temperature: data.frameworkConfig.temperature });
                    // Go back and overwrite the "Formatting..." message
                    this.y -= 8.25; // Go back one line + paragraph space
                    this.doc.setFillColor('white');
                    this.doc.rect(this.margin, this.y - 4, this.contentWidth, 10, 'F');
                    
                    if (!formattedContent.startsWith('Error:')) {
                        this.addText(formattedContent);
                    } else {
                        this.addText("Failed to format summary. Displaying raw data as fallback.", {fontStyle: 'italic'});
                        this.addText(JSON.stringify(summarizeAgent.data, null, 2), { isMono: true });
                    }
                } else {
                    this.addText("PDF formatter agent not found. Displaying raw data as fallback.", {fontStyle: 'italic'});
                    this.addText(JSON.stringify(summarizeAgent.data, null, 2), { isMono: true });
                }
            } else {
                this.addText(summarizeAgent.content || 'No content available.');
            }
        }
        
        // ---- Expert Discussion ----
        this.addSectionHeader('2. Expert Discussion');
        this.y +=1;
        data.discussionMessages.forEach(msg => {
            if(msg.type === 'agent') {
                const agentMsg = msg as UserChatMessage;
                this.checkPageBreak(12);
                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(this.C_HEADING);
                const agentName = agentMsg.agentName.split(':')[1]?.trim() || agentMsg.agentName;
                this.doc.text(`${agentName}:`, this.margin, this.y);
                this.y += 6; // Space for the name line
                this.addText(agentMsg.message, { indent: 5 }); // Indent message under name
            }
        });

        // ---- Executive Summary ----
        this.addSectionHeader('3. Executive Summary');
        this.y += 6;
        // Iteration Analysis
        this.addSubHeader('Iteration Analysis Summary');
        
        if (data.expertOpinions.length > 0) {
            // Find the median iteration
            const scores = data.expertOpinions.map(o => o.feasibilityScore);
            const sortedScores = [...scores].sort((a, b) => a - b);
            const mid = Math.floor(sortedScores.length / 2);
            const medianScore = sortedScores.length % 2 === 0 
                ? (sortedScores[mid - 1] + sortedScores[mid]) / 2
                : sortedScores[mid];
            
            const medianIteration = data.expertOpinions.find(o => 
                Math.abs(o.feasibilityScore - medianScore) === Math.min(...scores.map(s => Math.abs(s - medianScore)))
            );

            // Show all iterations briefly
            data.expertOpinions.forEach((opinion, index) => {
                this.checkPageBreak(8);
                const isMedian = medianIteration && opinion.feasibilityScore === medianIteration.feasibilityScore;
        
                this.doc.setFontSize(11);
                this.doc.setFont('helvetica','normal');
                this.doc.setTextColor(isMedian ? this.C_PRIMARY : this.C_HEADING);
                this.doc.text(`Iteration ${index + 1}: Score ${opinion.feasibilityScore}/100${isMedian ? ' (Median)' : ''}`, this.margin, this.y);
                this.y += 5;
            });
            
            this.y += 6;
            
            // Focus on median iteration
            if (medianIteration) {
                this.addSubHeader('Primary Analysis (Based on Median Iteration)');
                this.addText(`The following analysis is based on the median scoring iteration with a feasibility score of ${medianIteration.feasibilityScore}/100:`, { fontStyle: 'italic' });
                this.y += 4;
                this.addText(medianIteration.summary);
                this.y += 6;
            }
        }
        
        // Google Search Results
        this.addGoogleSearchResults(data);
        
        // Final Decision
        this.addSubHeader('Final Decision Summary');
        if (data.finalDecision?.content && !data.finalDecision.content.startsWith('Error:')) {
            try {
                const decisionData = JSON.parse(data.finalDecision.content);
                
                // Add explanatory text about the methodology
                this.addText('This final decision is based on statistical analysis of multiple independent iterations:', { fontStyle: 'italic' });
                this.y += 2;
                
                if (decisionData.statistics) {
                    this.addText(`• Number of iterations: ${decisionData.iterations?.length || 'N/A'}`);
                    this.addText(`• Median score: ${decisionData.statistics.median?.toFixed(1) || 'N/A'}/100`);
                    this.addText(`• Standard deviation: ${decisionData.statistics.standardDeviation?.toFixed(1) || 'N/A'}`);
                    this.addText(`• Confidence level: ${decisionData.statistics.confidenceLevel || 'N/A'}`);
                    this.y += 6;
                }
                
                // Draw a styled box for the final decision
                const boxStartY = this.y;
                
                const decisionText = `Decision: ${decisionData.decision}\n\nJustification: ${decisionData.justification}`;
                const textLines = this.doc.splitTextToSize(decisionText, this.contentWidth - 10);
                // Estimate height based on lines and line spacing
                const boxHeight = 10 + (decisionData.justification.split('\n').length * 5.5) + (this.doc.splitTextToSize(decisionData.justification, this.contentWidth-15).length * 5.5);

                this.checkPageBreak(boxHeight + 5);

                this.doc.setFillColor('#f8fafc'); // slate-50
                this.doc.setDrawColor(this.C_BORDER);
                this.doc.setLineWidth(0.2);
                this.doc.rect(this.margin, this.y, this.contentWidth, boxHeight, 'FD');
                this.y += 5;

                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(this.C_HEADING);
                this.doc.text('Final Decision:', this.margin + 5, this.y);
                this.doc.setFont('helvetica', 'normal');
                this.doc.setTextColor(this.C_PRIMARY);
                this.doc.text(decisionData.decision, this.margin + 35, this.y);
                this.y += 7;

                this.doc.setFont('helvetica', 'bold');
                this.doc.setTextColor(this.C_HEADING);
                this.doc.text('Justification:', this.margin + 5, this.y);
                this.y += 5;
                this.doc.setFont('helvetica', 'normal');
                this.doc.setTextColor(this.C_TEXT_DARK);
                
                const justificationLines = this.doc.splitTextToSize(decisionData.justification, this.contentWidth - 15);
                const lineHeight = 5.5; // Consistent line height
                for(const line of justificationLines) {
                    this.doc.text(line, this.margin + 5, this.y);
                    this.y += lineHeight;
                }
                
                this.y = boxStartY + boxHeight + 5;

            } catch (e) {
                this.addText('Error parsing final decision.', { fontStyle: 'italic' });
            }
        } else {
            this.addText('Final decision not available.', { fontStyle: 'italic' });
        }

        // Detailed Iteration Results
        this.addIterationDetails(data);

        // Full Expert Discussion Output
        this.addFullExpertDiscussion(data);

        // Complete Expert Discussion Dialogue
        this.addCompleteExpertDialogue(data);

        // Save PDF
        this.doc.save('ai-analysis-report.pdf');
        
        // Export JSON
        this.exportJSON(data);
    }

    private addIterationDetails(data: GeneratorData) {
        if (!data.expertOpinions || data.expertOpinions.length === 0) {
            return;
        }

        // Add a new section for detailed iteration results
        this.addSectionHeader('4. Detailed Iteration Results');
        
        this.addText('This section provides the complete analysis from each independent iteration of the expert discussion and feasibility assessment process.', { fontStyle: 'italic' });
        this.y += 6;

        // Parse final decision to get iteration details if available
        let iterationData: any[] = [];
        if (data.finalDecision?.content && !data.finalDecision.content.startsWith('Error:')) {
            try {
                const decisionData = JSON.parse(data.finalDecision.content);
                iterationData = decisionData.iterations || [];
            } catch (e) {
                console.warn('Could not parse final decision for iteration details');
            }
        }

        // Display each iteration
        data.expertOpinions.forEach((opinion, index) => {
            const iterationNumber = index + 1;
            const iterationDetails = iterationData.find(iter => iter.iteration === iterationNumber);
            
            // Check for page break - need more space for iteration details
            this.checkPageBreak(35);

            // Iteration header with score
            this.doc.setFillColor('#f1f5f9'); // slate-100
            this.doc.setDrawColor('#cbd5e1'); // slate-300
            this.doc.setLineWidth(0.2);
            this.doc.rect(this.margin, this.y, this.contentWidth, 8, 'FD');
            
            this.doc.setFont('helvetica', 'bold');
            this.doc.setFontSize(12);
            this.doc.setTextColor(this.C_HEADING);
            this.doc.text(`Iteration ${iterationNumber}`, this.margin + 3, this.y + 5);
            
            // Score display
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(this.C_PRIMARY);
            const scoreText = `Score: ${opinion.feasibilityScore}/100`;
            const scoreWidth = this.doc.getTextWidth(scoreText);
            this.doc.text(scoreText, this.margin + this.contentWidth - scoreWidth - 3, this.y + 5);
            
            this.y += 15;

            // Rationale/Summary
            this.doc.setFont('helvetica', 'bold');
            this.doc.setFontSize(10);
            this.doc.setTextColor(this.C_HEADING);
            this.doc.text('Analysis:', this.margin, this.y);
            this.y += 5;

            this.doc.setFont('helvetica', 'normal');
            this.doc.setTextColor(this.C_TEXT_DARK);
            const analysisText = opinion.summary || iterationDetails?.rationale || 'No detailed analysis available.';
            const analysisLines = this.doc.splitTextToSize(analysisText, this.contentWidth - 5);
            
            for (const line of analysisLines) {
                this.checkPageBreak(5);
                this.doc.text(line, this.margin, this.y);
                this.y += 4.5;
            }

            // Key factors if available
            if (iterationDetails?.keyFactors && iterationDetails.keyFactors.length > 0) {
                this.y += 2;
                this.doc.setFont('helvetica', 'bold');
                this.doc.setFontSize(10);
                this.doc.setTextColor(this.C_HEADING);
                this.doc.text('Key Factors:', this.margin, this.y);
                this.y += 6;

                this.doc.setFont('helvetica', 'normal');
                this.doc.setTextColor(this.C_TEXT_DARK);
                iterationDetails.keyFactors.forEach((factor: string) => {
                    this.checkPageBreak(4);
                    this.doc.text(`• ${factor}`, this.margin + 3, this.y);
                    this.y += 4;
                });
            }

            this.y += 6; // Space between iterations
        });
    }

    private addFullExpertDiscussion(data: GeneratorData) {
        this.addSectionHeader('5. Complete Expert Discussion Iterations');
        
        this.addText('This section contains the complete output from all iterations of the expert discussion process.', { fontStyle: 'italic' });
        this.y += 6;

        data.expertOpinions.forEach((opinion, index) => {
            this.checkPageBreak(20);
            
            // Iteration header
            this.addSubHeader(`Iteration ${index + 1} - Complete Output`);
            this.addText(`Feasibility Score: ${opinion.feasibilityScore}/100`, { fontStyle: 'bold' });
            this.y += 4;
            
            // Full summary
            this.addText('Complete Analysis:', { fontStyle: 'bold' });
            this.addText(opinion.summary, { indent: 5 });
            this.y += 6;
            
            // Add raw output if available
            if (opinion.rawOutput) {
                this.addText('Raw Output:', { fontStyle: 'bold' });
                this.addText(opinion.rawOutput, { indent: 5, isMono: true });
                this.y += 6;
            }
            
            this.y += 8; // Extra space between iterations
        });
    }

    private addCompleteExpertDialogue(data: GeneratorData) {
        this.addSectionHeader('6. Expert Discussion Dialogues by Iteration');
        
        this.addText('This section shows expert dialogues grouped by iteration, with each expert\'s complete responses for every iteration.', { fontStyle: 'italic' });
        this.y += 6;

        // Show dialogues grouped by iteration using expertOpinions which now contain discussionHistory
        if (data.expertOpinions && data.expertOpinions.length > 0) {
            data.expertOpinions.forEach((opinion, iterationIndex) => {
                const iterationNumber = opinion.iteration || (iterationIndex + 1);
                
                this.checkPageBreak(20);
                
                // Iteration header
                this.addSubHeader(`Iteration ${iterationNumber} (Score: ${opinion.feasibilityScore}/100)`);
                
                if (opinion.discussionHistory && opinion.discussionHistory.length > 0) {
                    // Group messages by expert
                    const expertMessages: Record<string, string[]> = {};
                    
                    opinion.discussionHistory.forEach((msg) => {
                        if (msg.type === 'agent') {
                            const agentMsg = msg as UserChatMessage;
                            const expertName = agentMsg.agentName.split(':')[1]?.trim() || agentMsg.agentName;
                            
                            if (!expertMessages[expertName]) {
                                expertMessages[expertName] = [];
                            }
                            expertMessages[expertName].push(agentMsg.message);
                        }
                    });

                    // Display each expert's complete dialogue for this iteration
                    Object.entries(expertMessages).forEach(([expertName, messages]) => {
                        this.checkPageBreak(15);
                        
                        this.doc.setFont('helvetica', 'bold');
                        this.doc.setFontSize(10);
                        this.doc.setTextColor(this.C_PRIMARY);
                        this.doc.text(`${expertName}:`, this.margin, this.y);
                        this.y += 6;
                        
                        // Show all messages from this expert in this iteration
                        messages.forEach((message, msgIndex) => {
                            if (messages.length > 1) {
                                this.doc.setFont('helvetica', 'italic');
                                this.doc.setFontSize(9);
                                this.doc.setTextColor(this.C_TEXT_LIGHT);
                                this.doc.text(`Message ${msgIndex + 1}:`, this.margin + 3, this.y);
                                this.y += 4;
                            }
                            
                            this.doc.setFont('helvetica', 'normal');
                            this.doc.setFontSize(9);
                            this.doc.setTextColor(this.C_TEXT_DARK);
                            const messageLines = this.doc.splitTextToSize(message, this.contentWidth - 10);
                            
                            for (const line of messageLines) {
                                this.checkPageBreak(4);
                                this.doc.text(line, this.margin + 5, this.y);
                                this.y += 4;
                            }
                            this.y += 3;
                        });
                        
                        this.y += 3; // Space between experts
                    });
                } else {
                    this.addText('No expert dialogue recorded for this iteration.', { fontStyle: 'italic', indent: 5 });
                }
                
                // Add iteration summary
                this.y += 4;
                this.doc.setFont('helvetica', 'bold');
                this.doc.setFontSize(9);
                this.doc.setTextColor(this.C_HEADING);
                this.doc.text('Iteration Summary:', this.margin, this.y);
                this.y += 4;
                
                this.doc.setFont('helvetica', 'normal');
                this.doc.setTextColor(this.C_TEXT_DARK);
                const summaryLines = this.doc.splitTextToSize(opinion.summary, this.contentWidth - 5);
                
                for (const line of summaryLines) {
                    this.checkPageBreak(4);
                    this.doc.text(line, this.margin + 3, this.y);
                    this.y += 4;
                }
                
                this.y += 10; // Space between iterations
            });
        } else {
            this.addText('No expert discussion iterations available.', { fontStyle: 'italic' });
        }
    }

    private exportJSON(data: GeneratorData) {
        // Create comprehensive JSON export with all outputs and iterations
        const exportData = {
            timestamp: new Date().toISOString(),
            proposal: data.proposal,
            initialAnalysis: {
                classification: data.section1Outputs.proposal_classification_agent,
                summary: data.section1Outputs.proposal_information_summarize_agent
            },
            expertDiscussion: {
                iterationBasedDialogue: data.expertOpinions.map((opinion, index) => {
                    const iterationNumber = opinion.iteration || (index + 1);
                    
                    // Group expert messages by expert for this iteration
                    const expertDialogues: Record<string, string[]> = {};
                    
                    if (opinion.discussionHistory) {
                        opinion.discussionHistory.forEach((msg) => {
                            if (msg.type === 'agent') {
                                const agentMsg = msg as UserChatMessage;
                                const expertName = agentMsg.agentName.split(':')[1]?.trim() || agentMsg.agentName;
                                
                                if (!expertDialogues[expertName]) {
                                    expertDialogues[expertName] = [];
                                }
                                expertDialogues[expertName].push(agentMsg.message);
                            }
                        });
                    }
                    
                    return {
                        iteration: iterationNumber,
                        feasibilityScore: opinion.feasibilityScore,
                        expertDialogues: expertDialogues,
                        summary: opinion.summary,
                        timestamp: opinion.timestamp || new Date().toISOString()
                    };
                }),
                lastIterationMessages: data.discussionMessages.map((msg, index) => ({
                    messageIndex: index + 1,
                    type: msg.type,
                    agentId: msg.type === 'agent' ? (msg as UserChatMessage).agentId : null,
                    agentName: msg.type === 'agent' ? (msg as UserChatMessage).agentName : null,
                    message: msg.type === 'agent' ? (msg as UserChatMessage).message : (msg as any).message,
                    timestamp: new Date().toISOString()
                })),
                iterationStatistics: {
                    totalIterations: data.expertOpinions.length,
                    averageScore: data.expertOpinions.length > 0 ? 
                        data.expertOpinions.reduce((sum, op) => sum + op.feasibilityScore, 0) / data.expertOpinions.length : 0,
                    scoreRange: data.expertOpinions.length > 0 ? {
                        min: Math.min(...data.expertOpinions.map(op => op.feasibilityScore)),
                        max: Math.max(...data.expertOpinions.map(op => op.feasibilityScore))
                    } : null
                }
            },
            finalDecision: data.finalDecision,
            agentConfigs: data.agentConfigs,
            frameworkMetrics: data.frameworkMetrics
        };

        // Download JSON file
        const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(jsonBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-analysis-report-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private addGoogleSearchResults(data: GeneratorData) {
        if (!data.frameworkMetrics?.googleSearchSummary || data.frameworkMetrics.googleSearchSummary.totalUsageCount === 0) {
            return;
        }

        this.addSubHeader('Google Search Results');
        
        const summary = data.frameworkMetrics.googleSearchSummary;
        this.addText(`Total searches performed: ${summary.totalUsageCount}`);
        this.addText(`Total queries: ${summary.totalQueries}`);
        this.addText(`Total sources found: ${summary.totalSources}`);
        this.addText(`Agents that used Google Search: ${summary.agentsUsed.join(', ')}`);
        this.y += 5;

        // Add detailed results for each agent
        Object.entries(data.frameworkMetrics.agentBreakdown).forEach(([agentId, metrics]: [string, any]) => {
            if (metrics.googleSearchUsage?.used) {
                this.addText(`${agentId}:`, { fontStyle: 'bold' });
                
                if (metrics.googleSearchUsage.queries?.length > 0) {
                    this.addText('Search Queries:', { fontStyle: 'italic' });
                    metrics.googleSearchUsage.queries.forEach((query: string, index: number) => {
                        this.addText(`  ${index + 1}. ${query}`);
                    });
                }
                
                if (metrics.googleSearchUsage.sources?.length > 0) {
                    this.addText('Sources:', { fontStyle: 'italic' });
                    metrics.googleSearchUsage.sources.forEach((source: any, index: number) => {
                        if (source.title && source.uri) {
                            this.addText(`  ${index + 1}. ${source.title}`);
                            this.addText(`     ${source.uri}`, { fontSize: 8 });
                            if (source.snippet) {
                                this.addText(`     ${source.snippet}`, { fontSize: 8, fontStyle: 'italic' });
                            }
                        }
                    });
                }
                this.y += 3;
            }
        });
    }
}

export const generatePdf = async (data: GeneratorData) => {
    const generator = new PdfReportGenerator();
    await generator.generate(data);
};