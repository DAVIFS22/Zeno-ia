import re
with open('src/components/ComposerInput.tsx', 'r') as f:
    content = f.read()

# I will replace:
#           </div>
#         </div>
# 
#           <button
# with:
#           </div>
#           <button

content = content.replace('''          </div>
        </div>

          <button
            type="button"''', '''          </div>

          <button
            type="button"''')

with open('src/components/ComposerInput.tsx', 'w') as f:
    f.write(content)
