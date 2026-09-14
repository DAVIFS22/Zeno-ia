# Zeno IA - Design System Guidelines

## Core Colors

The visual identity of Zeno IA must STRICTLY use two official colors:

### 1. Zeno Blue (Primary Identity)
- **HEX:** `#0084DF`
- **RGB:** `rgb(0, 132, 223)`
- **Tailwind Tokens:** `bg-zeno`, `text-zeno`, `border-zeno`, `ring-zeno`, `stroke-zeno`, `fill-zeno` (Configured as `--color-zeno` in CSS).
- **Usage:** Primary buttons, "New chat", "Save", "Send", active icons, active navigation, links, selected states, indicators, badges, highlights, interactive focus states.
- **Transparency:** Use standard Tailwind opacity modifiers: `bg-zeno/10`, `bg-zeno/20`, `hover:bg-zeno/90`.
- **Constraint:** NEVER introduce new blue shades (`blue-*`, `sky-*`, `indigo-*`, `cyan-*` or custom HEX) to represent Zeno IA's identity.

### 2. Zeno White (Secondary Identity)
- **HEX:** `#FFFFFF`
- **RGB:** `rgb(255, 255, 255)`
- **Usage:** Primary text, headings, usernames, Zeno's name, blue button labels, primary icons, high-contrast elements, important content, selected text, elements requiring maximum contrast.
- **Constraint:** Do not use different shades of white when the official white is intended.

## Neutrals and Grays
- Grays and neutrals are still permitted for backgrounds, cards, sidebars, borders, secondary text, disabled text, separators, and disabled states. Zeno White does not replace the entire neutral hierarchy.

## Exceptions
Other colors may be used ONLY for the following non-identity purposes:
- Syntax highlighting in code blocks
- Charts and data visualizations
- External content/media
- Images and illustrations
- Semantic states: Error (Red), Success (Green), Warning/Alerts (Yellow/Orange)
- Third-party components requiring their own branding

**CRITICAL RULE:** All new components must adhere to this system. The entire interface must feel cohesive and exclusively use `Zeno Blue` and `Zeno White` for brand identity.

## Agent Operations (Permanent Rule)

**CRITICAL INCIDENT RULE:** Nenhuma ação relatada pelo agente deve ser considerada concluída sem evidência visual (print, log ou output de comando). O agente não deve assumir sucesso de operações (como reescritas ou restaurações) por padrão. O agente deve sempre confirmar visualmente as mudanças lendo os arquivos no projeto (usando `view_file` ou equivalente) ou verificando output de logs antes de prosseguir com afirmações de que a tarefa foi concluída ou que o código foi restaurado.
