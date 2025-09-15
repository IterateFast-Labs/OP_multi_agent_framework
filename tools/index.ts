
import { financialModel } from './financialModel';
import { riskAssessor } from './riskAssessor';
import { ToolFunction } from '../types';

export const toolRegistry: Record<string, ToolFunction> = {
    financialModel,
    riskAssessor,
};

/**
 * Retrieves tool functions from the registry based on a list of IDs.
 * @param ids An array of string identifiers for the tools to retrieve.
 * @returns A record mapping the valid tool IDs to their functions.
 */
export const getTools = (ids: string[]): Record<string, ToolFunction> => {
    const selectedTools: Record<string, ToolFunction> = {};
    ids.forEach(id => {
        if (toolRegistry[id]) {
            selectedTools[id] = toolRegistry[id];
        }
    });
    return selectedTools;
};
