# advisor

Recommends switching Claude model tier based on task complexity — prepends a one-line hint to Claude's response when the current model is a poor fit.

## What it does

Fires on `UserPromptSubmit`. Classifies the prompt via Haiku (or another cheap LLM) and compares the recommended tier to the current model in `settings.json`.

- **haiku** → trivial: renames, quick questions, git commands
- **sonnet** → standard: features, debugging, code writing
- **opus** → complex: architecture, security audits, system design

When there's a mismatch, Claude prepends one line:
```
[model-advisor] → OPUS: /model claude-opus-4-6
```

You can switch with the command or ignore it. Prefix any prompt with `~` to skip classification entirely.

## Installation

```bash
npm install -g @eugene-bert/claude-hooks
claude-hooks install advisor
```

Then add to `~/.claude/CLAUDE.md`:
```markdown
## Model Advisor
If `additionalContext` contains `[model-advisor]` recommending a different tier than the current model,
prepend exactly one line to your response then answer normally:
`[model-advisor] → <TIER>: <SWITCH_CMD>`
```

## LLM providers

Same providers as notify — whichever credentials are set in `~/.claude/hooks/.env`:

| Provider | Env vars | Cost |
|----------|----------|------|
| Ollama | `OLLAMA_HOST` | Free (local) |
| OpenRouter | `OPENROUTER_API_KEY` | Pay per use |
| AWS Bedrock | `AWS_ACCESS_KEY_ID` or `AWS_PROFILE` | Pay per use |
| Google Vertex AI | `ANTHROPIC_VERTEX_PROJECT_ID` | Pay per use |
| Anthropic API | `ANTHROPIC_API_KEY` | Pay per use |

## Configuration

See [`.env.example`](.env.example) for all available variables.

Key options:

```env
# Available models per tier — comma-separated, first = primary, rest = fallbacks
MODEL_ADVISOR_HAIKU_MODELS=haiku
MODEL_ADVISOR_SONNET_MODELS=sonnet
MODEL_ADVISOR_OPUS_MODELS=claude-opus-4-6,opus

# Minimum prompt words to classify (0 = classify everything)
MODEL_ADVISOR_MIN_WORDS=0
```

## Caching

Prompts are cached by SHA256 hash for 7 days — identical prompts skip the API call.
