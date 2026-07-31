import re
with open('src/components/ComposerInput.tsx', 'r') as f:
    content = f.read()

# Remove the button that opens the model selector
# Find the button containing getModelDef(speed).name
# It starts around line 224: <button type="button" onClick={(e) => { ... }} className="flex items-center gap-1.5 px-3 py-1.5 ...">
content = re.sub(
r'<button\s+type="button"\s+onClick=\{[^}]+\}\s+className="flex items-center gap-1\.5[^>]+>[\s\S]*?</button>',
r"""{/* O usuário nunca escolhe o modelo manualmente */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#18181c] border border-[#2C2C2E] shadow-sm cursor-default">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-[13px] font-medium text-neutral-200">
              ZENO Smart
            </span>
          </div>""",
content)

# We can also just remove the {isSpeedMenuOpen && (...)}
content = re.sub(r'\{isSpeedMenuOpen && \([\s\S]*?</AnimatePresence>', r'</AnimatePresence>', content)

with open('src/components/ComposerInput.tsx', 'w') as f:
    f.write(content)
