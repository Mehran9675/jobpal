import type { OverlayPosition } from './store';

let suppressNextClick = false;

export function consumeSuppressedClick(): boolean {
  if (!suppressNextClick) return false;
  suppressNextClick = false;
  return true;
}

export function applyPosition(element: HTMLElement, position: OverlayPosition | null, fallback: { right: number; bottom: number }): void {
  if (position) {
    element.style.left = `${position.left}px`;
    element.style.top = `${position.top}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  } else {
    element.style.left = 'auto';
    element.style.top = 'auto';
    element.style.right = `${fallback.right}px`;
    element.style.bottom = `${fallback.bottom}px`;
  }
}

/** Moves an element back inside the viewport. Returns true when it had to move. */
export function clampToViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  let dx = 0;
  let dy = 0;
  if (rect.right > window.innerWidth - 8) dx = window.innerWidth - 8 - rect.right;
  if (rect.left + dx < 8) dx = 8 - rect.left;
  if (rect.bottom > window.innerHeight - 8) dy = window.innerHeight - 8 - rect.bottom;
  if (rect.top + dy < 8) dy = 8 - rect.top;
  if (dx === 0 && dy === 0) return false;
  element.style.left = `${rect.left + dx}px`;
  element.style.top = `${rect.top + dy}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  return true;
}

/**
 * Lets the user drag an element (button or panel header) out of the way.
 * Buttons inside the handle keep working because drags never start on them.
 */
export function makeDraggable(
  handle: HTMLElement,
  getTarget: () => HTMLElement | null,
  onDrop: (position: OverlayPosition) => void,
): () => void {
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let dragging = false;
  let moved = false;

  handle.style.touchAction = 'none';

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    // Ignore interactive controls inside the handle (close, A-/A+, switch),
    // but allow the handle itself to be a control (the floating JobPaal button).
    const pressedControl = target?.closest('button, a, input, label, select, textarea, [role="switch"], [data-no-drag]');
    if (pressedControl && pressedControl !== handle) return;
    const element = getTarget();
    if (!element) return;
    const rect = element.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    dragging = true;
    moved = false;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best effort */
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    moved = true;
    const element = getTarget();
    if (!element) return;
    const width = element.offsetWidth || 60;
    const height = element.offsetHeight || 60;
    const left = Math.min(Math.max(4, window.innerWidth - width - 4), Math.max(4, startLeft + dx));
    const top = Math.min(Math.max(4, window.innerHeight - height - 4), Math.max(4, startTop + dy));
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.right = 'auto';
    element.style.bottom = 'auto';
  };

  const finish = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    const element = getTarget();
    if (element) {
      const rect = element.getBoundingClientRect();
      onDrop({ left: Math.round(rect.left), top: Math.round(rect.top) });
    }
    suppressNextClick = true;
    setTimeout(() => (suppressNextClick = false), 400);
    event.preventDefault();
    event.stopPropagation();
  };

  const onClickCapture = (event: MouseEvent) => {
    if (consumeSuppressedClick()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('click', onClickCapture, true);

  return () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('pointermove', onPointerMove);
    handle.removeEventListener('pointerup', finish);
    handle.removeEventListener('pointercancel', finish);
    handle.removeEventListener('click', onClickCapture, true);
  };
}
