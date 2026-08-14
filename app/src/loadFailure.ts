window.addEventListener('error', () => {
  const root = document.getElementById('root');
  if (!root) return;
  root.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'load-failure';
  const heading = document.createElement('h1');
  heading.textContent = 'FPIP could not start';
  const message = document.createElement('p');
  message.textContent = 'Refresh the page or contact your FPIP administrator with the request time.';
  panel.append(heading, message);
  root.append(panel);
});
