import re

with open('server.ts', 'r') as f:
    content = f.read()

# Replace the duplicated blocks
content = re.sub(
r"const ai = new GoogleGenAI\(\{[\s\S]*?\}\);\s*startHealthCheckLoop\(ai\);[\s\S]*?\}\);",
"""const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy_key',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Start provider health check loop in background
startHealthCheckLoop(ai);""",
content)

with open('server.ts', 'w') as f:
    f.write(content)
