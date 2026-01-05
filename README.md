# claude_databricks_proxy

## Running the proxy
```bash
// Normal mode: Concise, actionable logging
node main.js

// Verbose mode: Full request/response inspection
VERBOSE=true node main.js
```

## Configuration
To use the proxy, VS Code only needs three environment variables:

{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3000/serving-endpoints/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your-databricks-token",
    "ANTHROPIC_MODEL": "databricks-claude-sonnet-4-5"
  }
}
The extension believes it's talking to Anthropic's API, while the proxy silently handles the translation layer.
