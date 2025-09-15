# Google Search Tool Pricing Impact

## Overview
The Google Search tool integration with Gemini API adds grounding capabilities to provide real-time web information and citations.

## Pricing Structure
- **Per API Request**: Billed per API request that includes the `google_search` tool
- **Multiple Queries**: If the model executes multiple search queries within a single API call, it counts as ONE billable use
- **Additional Cost**: This is an add-on cost to the standard Gemini API token pricing

## Cost Impact Analysis
When Google Search is enabled:
1. **Standard token costs** still apply for input/output tokens
2. **Additional Google Search cost** per request that uses the tool
3. **Not all requests trigger search** - the model decides when search is needed

## Usage in Framework
- **Toggle Control**: Users can enable/disable Google Search per simulation
- **Expert Discussion Only**: Google Search is ONLY used by Expert Discussion agents (expert_1, expert_2, expert_3)
- **No Search for**: Classification, Summarization, Final Decision, Performance Tracking, or QA Update agents
- **Model Upgrade**: Expert agents use Gemini 2.5 Pro for enhanced reasoning with search data
- **Other Agents**: Continue using Gemini 2.5 Flash for cost efficiency

## Recommendations
1. Use Google Search for proposals requiring current market data, regulations, or recent events
2. Disable for internal process discussions or historical analysis
3. Monitor usage through framework metrics tracking

For detailed pricing: https://ai.google.dev/gemini-api/docs/pricing
