(() => {
  'use strict';
  if (window.__gpScrollProgressInitialized) return;
  window.__gpScrollProgressInitialized = true;

  const bar = document.createElement('div');
  bar.id = 'gp-scroll-progress';
  bar.setAttribute('role', 'progressbar');
  bar.setAttribute('aria-label', 'Page scroll progress');
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');
  const fill = document.createElement('span');
  fill.id = 'gp-scroll-progress-fill';
  bar.appendChild(fill);

  const status = document.createElement('div');
  status.id = 'gp-scroll-status';
  status.setAttribute('aria-live', 'off');
  status.textContent = '0% viewed · 100% left';

  function mount() {
    if (!bar.isConnected) document.body.appendChild(bar);
    if (!status.isConnected) document.body.appendChild(status);
    update();
  }

  let scheduled = false;
  function update() {
    scheduled = false;
    const root = document.documentElement;
    const scrollable = Math.max(0, root.scrollHeight - window.innerHeight);
    const position = Math.max(0, window.scrollY || root.scrollTop || 0);
    const percent = scrollable <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(position / scrollable * 100)));
    const remaining = 100 - percent;
    fill.style.width = percent + '%';
    bar.setAttribute('aria-valuenow', String(percent));
    status.textContent = scrollable <= 0 ? 'No more content' : `${percent}% viewed · ${remaining}% left`;
    status.style.display = scrollable <= 0 ? 'none' : 'block';
  }
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('load', scheduleUpdate, { once: true });
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleUpdate);
    const observeContent = () => {
      if (document.body) observer.observe(document.body);
      if (document.documentElement) observer.observe(document.documentElement);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeContent, { once: true });
    else observeContent();
  }
})();
