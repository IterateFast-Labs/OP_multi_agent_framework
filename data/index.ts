import { DataSource } from '../types';

// Use a Record for type safety, mapping string IDs to their file paths relative to the root.
const dataSourcePaths: Record<string, string> = {
    'token_holder_stats': '/data/token_holder_stats.json',
    'protocol_usage_data': '/data/protocol_usage_data.json',
};

/**
 * Loads multiple data sources dynamically based on a list of IDs.
 * It filters out invalid IDs and fetches the data concurrently.
 * @param ids An array of string identifiers for the data sources to load.
 * @returns A promise that resolves to an array of loaded DataSource objects.
 */
export const loadDataSources = async (ids: string[]): Promise<DataSource[]> => {
    const promises = ids
        .filter(id => dataSourcePaths[id]) // Ensure the ID exists in our map
        .map(id => fetch(dataSourcePaths[id]).then(res => res.json()));

    return Promise.all(promises);
};