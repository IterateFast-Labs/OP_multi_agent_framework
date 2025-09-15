# AI Multi-Agent Decision Framework

This application demonstrates a collaborative AI framework where multiple specialized AI agents work together to analyze a proposal, discuss their findings, and reach a synthesized conclusion. The entire process is visualized in a real-time dashboard interface.

## Notice(September 2025)

**Please be aware that the Agent Discussion Function (QA with Agents) is still under development and is currently unstable. Therefore, we do not recommend using it at this time.**

## How It Works: The Overall Flow

The application operates in a sequential, multi-phase process orchestrated by the main `App.tsx` component after a user uploads a proposal.

1.  **Configuration Loading**: The app first loads the agent configurations from `/agent_config.json`. This file defines the identity, model, and base prompts for every AI agent in the system.

2.  **User Input**: The user uploads a JSON file containing the proposal's basic information and a URL pointing to the full proposal text (e.g., on a governance forum).

3.  **Phase 1: Initial Analysis & Summarization**:
    *   Two initial agents run in parallel:
        1.  **Proposal Classification Agent**: Classifies the proposal based on its description against a predefined governance framework.
        2.  **Proposal Information Summarize Agent**: This is the key data-gathering agent. It takes the URL from the user's input, prepends it with `https://r.jina.ai/` to use the Jina Reader API, and fetches the full, real-time content from the web page. It then summarizes this content into basic information and a digest of community discussions and opinions.
    *   This ensures the analysis is based on the most up-to-date version of the proposal and community sentiment.

4.  **Phase 2: Context Building**:
    *   The outputs from the two initial agents (the classification and the URL content summary) are combined to form a comprehensive context.

5.  **Phase 3: Expert Discussion**:
    *   A simulated multi-turn discussion is initiated between several expert agents (e.g., Finance, Technology, Governance).
    *   Each expert is provided with the full context from the initial analysis and the ongoing conversation history. They generate a response based on their specific area of expertise and the current state of the discussion.
    *   The conversation proceeds turn-by-turn, with each expert's message appearing on the dashboard as it's generated.

6.  **Phase 4: Final Decision**:
    *   Once the expert discussion is complete, the entire transcript is passed to the `Final Decision Agent`.
    *   This agent's sole purpose is to synthesize the entire conversation and produce a final, structured JSON output containing:
        *   A clear decision (`Proceed`, `Do Not Proceed`, etc.).
        *   A concise justification for the decision.
        *   A summary of each expert's opinion and a calculated "feasibility score".

7.  **UI Rendering**: The UI, built with React and TailwindCSS, reactively updates throughout this entire process, showing loading states for agents that are "thinking" and displaying the results in various dashboard components as they become available.

---

## How to Modify Agents & Behavior

The framework is highly customizable. You can change the agents' roles and the discussion flow.

### 1. Modifying Agents (`agent_config.json`)

This is the primary file for controlling AI behavior. Each agent has an entry with the following key fields:

*   `name`: The display name of the agent.
*   `model`: The Gemini model to use (e.g., `gemini-2.5-flash`).
*   `systemInstruction`: (Optional) A high-level instruction that defines the agent's persona, expertise, and response constraints (e.g., "You are a financial analyst... keep your responses to 1-3 sentences").
*   `prompt`: The specific task or question you are asking the agent. You can use placeholders like `{expert_discussion_transcript}` which are dynamically replaced by the application.
*   `responseMimeType`: (Optional) Use `"application/json"` if you expect the agent to return a structured JSON object. The app will automatically attempt to clean and parse it.

**To add a new expert:**
1.  Add a new agent object (e.g., `"expert_4"`) to `agent_config.json`.
2.  In `App.tsx`, add the new agent's ID to the `expertAgentIds` array within the `runSimulation` function.

### 2. Modifying the Scenario

*   **Change the Proposal**: Upload a different JSON file via the UI. The file must contain `proposal_info` (string), `date` (string), and `url` (string).
*   **Change Discussion Length**: In `App.tsx`, modify the `discussionTurns` variable inside the `runSimulation` function to control how many times each expert speaks.

---

## How to Run This Code in Local setup

[Local Setup Link](https://github.com/IterateFast-Labs/OP_multi_agent_framework/blob/main/LOCAL_SETUP.md)
