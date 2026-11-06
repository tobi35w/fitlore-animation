import { Pen } from './toon';

export function drawCalendar(p: Pen, x: number, y: number, w: number, h: number, state: any = {}) {
  p.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#eee8d5', 1);
}

export function drawWatch(p: Pen, x: number, y: number, r: number, redRing = true, plusTwo = false) {
  p.ell(x, y, r, r, '#1e2430', 2);
  p.ell(x, y, r * 0.85, r * 0.85, '#0b0f17', 1.5);
  // Dial numbers / glow
  if (redRing) {
    p.arc(x, y, r * 0.72, r * 0.72, -90, 160, 3.5, '#e04848');
    p.arc(x, y, r * 0.72, r * 0.72, 160, 270, 2.0, '#3a2024');
  } else if (plusTwo) {
    p.arc(x, y, r * 0.72, r * 0.72, 0, 360, 3.0, '#48c078');
  }
}

export function drawPedometer(p: Pen, x: number, y: number, w: number, h: number) {
  // 1965 Yamasa Manpo-kei vintage mechanical pedometer
  p.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], '#d8cfb8', 2);
  p.ell(x + w * 0.5, y + h * 0.45, w * 0.38, h * 0.32, '#f4ecd8', 1.5);
  // Brass dial and pointer
  p.ell(x + w * 0.5, y + h * 0.45, w * 0.08, h * 0.08, '#b89040', 1);
  p.stroke([[x + w * 0.5, y + h * 0.45], [x + w * 0.72, y + h * 0.3]], 2, '#202020');
}
