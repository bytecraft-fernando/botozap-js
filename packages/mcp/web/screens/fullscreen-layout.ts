import './fullscreen-layout.css';
const installations = new WeakMap<HTMLElement, () => void>();
/** One footer policy for screen-kit and Radar/conversation. No host DOM access. */
export function installFullscreenLayout(root: HTMLElement) {
  installations.get(root)?.();
  let active: HTMLElement | null = null;
  let pending = 0;
  let disposed = false;
  const visible = (element: HTMLElement) => !element.closest('[hidden]') && element.getClientRects().length > 0 && getComputedStyle(element).display !== 'none';
  const schedule = () => { if (!disposed && !pending) pending = requestAnimationFrame(update); };
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  function update() {
    pending = 0;
    if (disposed) return;
    const candidates = Array.from(root.querySelectorAll<HTMLElement>('.screen-card > .actions, .detail .actions'));
    const next = root.dataset.mode === 'fullscreen' ? candidates.reverse().find(el => el.childElementCount > 0 && visible(el)) ?? null : null;
    if (active !== next) { active?.classList.remove('fullscreen-actions'); resize?.disconnect(); active = next; active?.classList.add('fullscreen-actions'); if (active) resize?.observe(active); }
    if (!active) { root.style.setProperty('--fullscreen-action-height','0px'); return; }
    const container = active.closest<HTMLElement>('.detail, .screen-card')!;
    const rect = container.getBoundingClientRect();
    const inset = Math.min(20, Math.max(12, innerWidth * .025));
    active.style.setProperty('--footer-left', `${Math.max(inset,rect.left)}px`);
    active.style.setProperty('--footer-width', `${Math.max(0, Math.min(rect.width,innerWidth-inset*2))}px`);
    root.style.setProperty('--fullscreen-action-height',`${Math.ceil(active.getBoundingClientRect().height)}px`);
  }
  const mutations = new MutationObserver(schedule);
  mutations.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-mode','data-state','hidden','class']});
  window.addEventListener('resize',schedule);
  window.addEventListener('scroll',schedule,{passive:true});
  const dispose = () => { disposed = true; cancelAnimationFrame(pending); mutations.disconnect(); resize?.disconnect(); window.removeEventListener('resize',schedule); window.removeEventListener('scroll',schedule); active?.classList.remove('fullscreen-actions'); };
  installations.set(root,dispose); schedule();
  return dispose;
}
