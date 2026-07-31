import re
with open('src/components/ComposerInput.tsx', 'r') as f:
    content = f.read()

# Replace from {isLocked ? ( to </div>            )}          </div>
content = re.sub(
    r'                        \{isLocked \? \([\s\S]*?</div>\s*\)\}\s*</div>',
    '',
    content
)

with open('src/components/ComposerInput.tsx', 'w') as f:
    f.write(content)
