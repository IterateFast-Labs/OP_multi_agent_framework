# Local Development Setup

## Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Gemini API key

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your Gemini API key:
   - Visit https://makersuite.google.com/app/apikey
   - Create a new API key
   - Copy the key

3. Update `.env` file with your actual API key:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```

### 3. Run the Application
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Key Changes Made for Local Development

1. **Environment Variables**: Added `.env` file support for `GEMINI_API_KEY`
2. **API Key Configuration**: Vite config properly loads environment variables
3. **External Dependencies**: 
   - Uses Jina Reader API for URL content fetching (requires internet)
   - Uses Gemini API for AI processing (requires API key)

## Troubleshooting

### API Key Issues
- Ensure your `.env` file has the correct `GEMINI_API_KEY`
- Check that the API key is valid and has proper permissions
- Make sure there are no extra spaces or quotes around the API key

### Network Issues
- The app requires internet access for:
  - Jina Reader API (to fetch proposal content from URLs)
  - Google Gemini API (for AI processing)

### Development Server
- If port 5173 is busy, Vite will automatically use the next available port
- Check the terminal output for the actual URL
