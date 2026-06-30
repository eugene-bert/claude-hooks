Disable Telegram notifications for the current Claude Code session. Run this bash command exactly:

```bash
PROJECT_KEY=$(pwd | sed 's|[/.]|-|g') && \
SESSION_ID=$(ls -t ~/.claude/projects/$PROJECT_KEY/*.jsonl 2>/dev/null | head -1 | xargs basename 2>/dev/null | sed 's/.jsonl//') && \
if [ -n "$SESSION_ID" ]; then \
  sed -i '' "/^$SESSION_ID$/d" ~/.claude/hooks/.notify-sessions 2>/dev/null; \
  echo "Notifications disabled for session $SESSION_ID"; \
else \
  echo "Could not find session ID"; \
fi
```

Report the output to the user.
