// Dezentes haptisches Feedback.
// iOS-Safari kennt navigator.vibrate nicht; ab iOS 18 löst das Umschalten eines
// <input type="checkbox" switch> aber einen leichten Systemimpuls aus – das nutzen wir.
let enabled = true;
let toggle = null;

export function setHaptics(on) {
  enabled = on;
}

function iosTick() {
  if (!toggle) {
    toggle = document.createElement('label');
    toggle.setAttribute('aria-hidden', 'true');
    toggle.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    toggle.appendChild(input);
    document.body.appendChild(toggle);
  }
  toggle.click();
}

export function haptic(kind = 'success') {
  if (!enabled) return;
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(kind === 'error' ? [25, 60, 25] : 12);
    return;
  }
  iosTick();
  if (kind === 'error') setTimeout(iosTick, 110);
}
