export function appendAiMessage(setChatMessages, text, extra = {}) {
  setChatMessages((prev) => [
    ...prev,
    {
      role: 'ai',
      text,
      ...extra,
    },
  ]);
}

export function showAiThinking(setChatMessages, text = 'Thinking...') {
  appendAiMessage(setChatMessages, text, { isThinking: true });
}

export function replaceThinkingWithAiMessage(setChatMessages, text) {
  setChatMessages((prev) => {
    const filtered = prev.filter((message) => !message.isThinking);
    return [
      ...filtered,
      {
        role: 'ai',
        text,
      },
    ];
  });
}

export function replaceThinkingWithAiError(setChatMessages, error) {
  replaceThinkingWithAiMessage(setChatMessages, `Error: ${error.message}`);
}
