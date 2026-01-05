# claude_databricks_proxy


## Running the proxy
```bash
# Clone this repo then run one of the following

# Normal mode: Concise, actionable logging
HOSTNAME=xxx.cloud.databricks.com node main.js

# Verbose mode: Full request/response inspection
VERBOSE=true HOSTNAME=xxx.cloud.databricks.com node main.js
```

## Configuration
To use the proxy, VS Code only needs three environment variables:

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:3000/serving-endpoints/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "your-databricks-token",
    "ANTHROPIC_MODEL": "databricks-claude-sonnet-4-5"
  }
}
```

The extension believes it's talking to Anthropic's API, while the proxy silently handles the translation layer.
