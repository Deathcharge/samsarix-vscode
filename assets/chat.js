(() => {
  'use strict';

  const vscode = acquireVsCodeApi();
  const elements = {
    connection: document.getElementById('connection'),
    endpoint: document.getElementById('endpoint'),
    model: document.getElementById('model'),
    notice: document.getElementById('notice'),
    contextCard: document.getElementById('context-card'),
    contextLabel: document.getElementById('context-label'),
    messages: document.getElementById('messages'),
    prompt: document.getElementById('prompt'),
    configure: document.getElementById('configure'),
    test: document.getElementById('test'),
    attach: document.getElementById('attach'),
    clearContext: document.getElementById('clear-context'),
    clearChat: document.getElementById('clear-chat'),
    send: document.getElementById('send'),
    propose: document.getElementById('propose'),
    cancel: document.getElementById('cancel'),
  };

  const connectionLabels = {
    untested: 'Not tested',
    testing: 'Testing…',
    connected: 'Connected',
    error: 'Needs attention',
  };

  const post = type => vscode.postMessage({ type });
  elements.configure.addEventListener('click', () => post('configure'));
  elements.test.addEventListener('click', () => post('test'));
  elements.attach.addEventListener('click', () => post('attachSelection'));
  elements.clearContext.addEventListener('click', () => post('clearContext'));
  elements.clearChat.addEventListener('click', () => post('clearChat'));
  elements.send.addEventListener('click', () => submit('send'));
  elements.propose.addEventListener('click', () => submit('proposeEdit'));
  elements.cancel.addEventListener('click', () => post('cancel'));
  elements.prompt.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      submit('send');
    }
  });

  window.addEventListener('message', event => {
    const state = event.data;
    if (!state || state.type !== 'state') {
      return;
    }
    render(state);
  });

  function submit(type) {
    const text = elements.prompt.value.trim();
    if (!text) {
      elements.prompt.focus();
      return;
    }
    vscode.postMessage({ type, text });
    if (type === 'send') {
      elements.prompt.value = '';
    }
  }

  function render(state) {
    const connection = Object.hasOwn(connectionLabels, state.connection)
      ? state.connection
      : 'error';
    elements.connection.textContent = connectionLabels[connection];
    elements.connection.dataset.state = connection;
    elements.endpoint.textContent = stringValue(state.endpoint);
    elements.model.textContent = stringValue(state.model);
    elements.notice.textContent = stringValue(state.notice);

    const hasContext = Boolean(state.context);
    elements.contextCard.hidden = !hasContext;
    elements.contextLabel.textContent = hasContext
      ? `${stringValue(state.context.label)} · ${numberValue(state.context.characterCount).toLocaleString()} characters`
      : '';

    const busy = Boolean(state.busy);
    elements.send.disabled = busy;
    elements.propose.disabled = busy || !state.trusted;
    elements.test.disabled = busy;
    elements.configure.disabled = busy;
    elements.attach.disabled = busy || !state.trusted;
    elements.clearContext.disabled = busy;
    elements.clearChat.disabled = busy;
    elements.prompt.disabled = busy;
    elements.cancel.disabled = !busy;

    renderMessages(Array.isArray(state.messages) ? state.messages : []);
  }

  function renderMessages(messages) {
    const fragment = document.createDocumentFragment();
    for (const message of messages) {
      if (!message || (message.role !== 'user' && message.role !== 'assistant')) {
        continue;
      }
      const article = document.createElement('article');
      article.className = `message ${message.role}`;

      const heading = document.createElement('strong');
      heading.textContent = message.role === 'user' ? 'You' : 'Samsarix';
      article.appendChild(heading);

      const content = document.createElement('p');
      content.textContent = stringValue(message.text);
      article.appendChild(content);

      if (message.role === 'assistant' && Number.isFinite(message.durationMs)) {
        const timing = document.createElement('small');
        timing.textContent = `${(message.durationMs / 1000).toFixed(1)} s on your configured model`;
        article.appendChild(timing);
      }
      fragment.appendChild(article);
    }

    elements.messages.replaceChildren(fragment);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function stringValue(value) {
    return typeof value === 'string' ? value : '';
  }

  function numberValue(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  vscode.postMessage({ type: 'ready' });
})();
