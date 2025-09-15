
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AgentConfig } from '../types';

// The API key MUST be obtained exclusively from the environment variable GEMINI_API_KEY.
// The app will assume this variable is pre-configured and valid.
if (!process.env.GEMINI_API_KEY) {
  // The UI will show an error message if the API call fails due to a missing key.
  console.error("GEMINI_API_KEY environment variable not set.");
} else {
  // Debug: Log API key format (first 10 chars only for security)
  const keyPrefix = process.env.GEMINI_API_KEY.substring(0, 10);
  console.log("API Key loaded. Prefix:", keyPrefix);
  
  if (!process.env.GEMINI_API_KEY.startsWith('AIza')) {
    console.warn("Warning: API key doesn't start with 'AIza'. This may indicate an invalid Google AI Studio key.");
  }
}

// In browser environments, we need to explicitly pass the API key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface RunAgentQueryArgs extends AgentConfig {
    // an optional dynamic prompt to override the one in the config.
    prompt: string;
    useGoogleSearch?: boolean;
    seed?: number | null;
    temperature?: number;
}

interface GoogleSearchMetadata {
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
}

/**
 * Runs a query using a specific agent configuration.
 * @param config The configuration for the agent, including the prompt to use.
 * @returns Object containing the content string and Google Search metadata.
 */
export const runAgentQuery = async (config: RunAgentQueryArgs): Promise<{ content: string; googleSearchMetadata: GoogleSearchMetadata }> => {
    if (!process.env.GEMINI_API_KEY) {
      return { 
        content: `Error: GEMINI_API_KEY is not configured. Please set the GEMINI_API_KEY environment variable.`, 
        googleSearchMetadata: { used: false, queriesCount: 0, sourcesCount: 0 }
      };
    }

    try {
        const temperature = config.temperature !== undefined ? config.temperature : 0; // Use provided temperature or default to 0
        console.log(`🌡️ Making LLM call with temperature=${temperature}${config.seed !== null && config.seed !== undefined ? ` seed=${config.seed}` : ''} for agent: ${config.name}${config.useGoogleSearch ? ' (with Google Search)' : ''}`);
        
        // Prepare tools array
        const tools = [];
        if (config.useGoogleSearch) {
            tools.push({ googleSearch: {} });
            console.log(`🔍 Google Search tool enabled for agent: ${config.name}`);
        }

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: config.model,
            contents: config.prompt, // Use the prompt passed in the config object
            config: {
                temperature: temperature,
                ...(config.seed !== null && config.seed !== undefined && { seed: config.seed }),
                ...(tools.length > 0 && { tools }),
                ...(config.systemInstruction && { systemInstruction: config.systemInstruction }),
                ...(config.responseMimeType && { responseMimeType: config.responseMimeType }),
                ...(config.responseSchema && { responseSchema: config.responseSchema }),
                ...(config.maxOutputTokens && { maxOutputTokens: config.maxOutputTokens }),
                ...(config.thinkingConfig && { thinkingConfig: config.thinkingConfig }),
            }
        });
        
        // Log token usage for successful calls
        if (response.usageMetadata) {
            const { promptTokenCount, candidatesTokenCount } = response.usageMetadata;
            // console.log(
            //     `[STATS] Agent: "${config.name}" | Model: ${config.model} | Input Tokens: ${promptTokenCount} | Output Tokens: ${candidatesTokenCount}`
            // );
        }

        // Collect Google Search metadata
        const googleSearchMetadata: GoogleSearchMetadata = { used: false, queriesCount: 0, sourcesCount: 0 };
        
        if (response.candidates?.[0]?.groundingMetadata) {
            const metadata = response.candidates[0].groundingMetadata;
            googleSearchMetadata.used = true;
            googleSearchMetadata.rawMetadata = metadata;
            console.log(`🌐 Google Search performed for agent: ${config.name}`);
            
            if (metadata.webSearchQueries) {
                googleSearchMetadata.queriesCount = metadata.webSearchQueries.length;
                googleSearchMetadata.queries = metadata.webSearchQueries;
                console.log(`🔍 Search queries used:`, metadata.webSearchQueries);
                console.log(`🔍 Detailed search queries:`, JSON.stringify(metadata.webSearchQueries, null, 2));
            }
            if (metadata.groundingChunks) {
                googleSearchMetadata.sourcesCount = metadata.groundingChunks.length;
                googleSearchMetadata.sources = metadata.groundingChunks.map((chunk: any) => ({
                    title: chunk.web?.title,
                    uri: chunk.web?.uri,
                    snippet: chunk.web?.snippet
                }));
                console.log(`📄 Sources found: ${metadata.groundingChunks.length} web results`);
                console.log(`📄 Detailed search sources:`, JSON.stringify(metadata.groundingChunks, null, 2));
            }
            if (metadata.searchEntryPoint) {
                console.log(`🎯 Search entry point:`, metadata.searchEntryPoint);
            }
            console.log(`🌐 Complete Google Search metadata:`, JSON.stringify(metadata, null, 2));
        }

        let content = response.text;

        // If a JSON response is expected, clean up markdown fences if they exist.
        // This is a good fallback even when using responseSchema.
        if (config.responseMimeType === 'application/json') {
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = content.match(fenceRegex);
            if (match && match[2]) {
              content = match[2].trim();
            }
        }
        
        return { content, googleSearchMetadata };

    } catch (error) {
        console.error(`Error running agent ${config.name}:`, error);
        return { 
            content: `Error: Could not get response from agent ${config.name}. Check console for details.`,
            googleSearchMetadata: { used: false, queriesCount: 0, sourcesCount: 0 }
        };
    }
};
