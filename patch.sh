sed -i 's/const response = await fetch('\''\/api\/chat'\'', {/console.log("SENDING FETCH TO \/api\/chat");\n      const response = await fetch('\''\/api\/chat'\'', {/' src/hooks/useChat.ts
sed -i 's/if (!response.ok) {/console.log("FETCH RETURNED", response.status);\n      if (!response.ok) {/' src/hooks/useChat.ts
sed -i 's/const reader = response.body?.getReader();/console.log("GETTING READER");\n      const reader = response.body?.getReader();/' src/hooks/useChat.ts
sed -i 's/const { done, value } = await reader.read();/console.log("READING CHUNK");\n          const { done, value } = await reader.read();\n          console.log("CHUNK DONE:", done);/' src/hooks/useChat.ts
