import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Fix 1: The IIFE
content = content.replace("              })()\n            {/* Plan Usage Card */}", "              })()}\n            {/* Plan Usage Card */}")

# Fix 2: The usage card block
content = content.replace('                 />\n              </div>\n            {/* Home / Welcome', '                 />\n              </div>\n            )}\n            {/* Home / Welcome')

# Fix 3: The welcome screen block
content = content.replace('                authLoading={authLoading}\n              />\n            {/* Conversation Messages Container', '                authLoading={authLoading}\n              />\n            )}\n            {/* Conversation Messages Container')

# Also wait, I might have messed up syntax with the extra )} inserted by sed. Let me just git restore.
