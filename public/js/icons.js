// @ts-check
/**
 * @file public/js/icons.js
 * @description Inline SVG icons built programmatically with document.createElementNS.
 * Adheres strictly to strict CSP constraints.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an SVG element with given attributes.
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @returns {SVGElement}
 */
function svgEl(tag, attrs = {}) {
  const el = /** @type {SVGElement} */ (document.createElementNS(SVG_NS, tag));
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

/**
 * Creates an inline SVG icon for a given icon identifier.
 * @param {'skull' | 'wallet' | 'shield' | 'hourglass' | 'rocket' | 'calendar' | 'copy' | 'check' | 'print' | 'refresh' | 'info' | 'arrow-right'} name
 * @param {string} [className]
 * @returns {SVGSVGElement}
 */
export function createIcon(name, className = 'icon') {
  const svg = /** @type {SVGSVGElement} */ (svgEl('svg', {
    class: className,
    viewBox: '0 0 24 24',
    width: '20',
    height: '20',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }));

  switch (name) {
    case 'skull': {
      // Skull icon (Pessimist)
      const path1 = svgEl('path', { d: 'M9 10h.01M15 10h.01' });
      const path2 = svgEl('path', { d: 'M8 20v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' });
      const path3 = svgEl('path', { d: 'M18 10a6 6 0 1 0-12 0c0 4 2 6 2 8h8c0-2 2-4 2-8z' });
      svg.append(path3, path1, path2);
      break;
    }

    case 'wallet': {
      // Wallet icon (Accountant)
      const path1 = svgEl('path', { d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1' });
      const path2 = svgEl('path', { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' });
      const circle = svgEl('circle', { cx: '18', cy: '14', r: '1' });
      svg.append(path1, path2, circle);
      break;
    }

    case 'shield': {
      // Shield icon (Skeptical Parent)
      const path = svgEl('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' });
      svg.appendChild(path);
      break;
    }

    case 'hourglass': {
      // Hourglass icon (Future You)
      const path = svgEl('path', { d: 'M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2' });
      svg.appendChild(path);
      break;
    }

    case 'rocket': {
      // Rocket icon (Optimist)
      const path1 = svgEl('path', { d: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z' });
      const path2 = svgEl('path', { d: 'm12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z' });
      const path3 = svgEl('path', { d: 'M9 12H4s.55-3.03 2-4.5c1.62-1.63 5-2.5 5-2.5' });
      const path4 = svgEl('path', { d: 'M12 15v5s3.03-.55 4.5-2c1.63-1.62 2.5-5 2.5-5' });
      svg.append(path1, path2, path3, path4);
      break;
    }

    case 'calendar': {
      // Calendar icon
      const rect = svgEl('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2', ry: '2' });
      const line1 = svgEl('line', { x1: '16', y1: '2', x2: '16', y2: '6' });
      const line2 = svgEl('line', { x1: '8', y1: '2', x2: '8', y2: '6' });
      const line3 = svgEl('line', { x1: '3', y1: '10', x2: '21', y2: '10' });
      svg.append(rect, line1, line2, line3);
      break;
    }

    case 'copy': {
      // Copy icon
      const rect = svgEl('rect', { x: '9', y: '9', width: '13', height: '13', rx: '2', ry: '2' });
      const path = svgEl('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' });
      svg.append(rect, path);
      break;
    }

    case 'check': {
      // Checkmark icon
      const path = svgEl('polyline', { points: '20 6 9 17 4 12' });
      svg.appendChild(path);
      break;
    }

    case 'print': {
      // Print icon
      const path1 = svgEl('polyline', { points: '6 9 6 2 18 2 18 9' });
      const path2 = svgEl('path', { d: 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2' });
      const rect = svgEl('rect', { x: '6', y: '14', width: '12', height: '8' });
      svg.append(path1, path2, rect);
      break;
    }

    case 'refresh': {
      // Retry / refresh icon
      const path1 = svgEl('path', { d: 'M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67' });
      svg.appendChild(path1);
      break;
    }

    case 'info': {
      // Info icon
      const circle = svgEl('circle', { cx: '12', cy: '12', r: '10' });
      const line1 = svgEl('line', { x1: '12', y1: '16', x2: '12', y2: '12' });
      const line2 = svgEl('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' });
      svg.append(circle, line1, line2);
      break;
    }

    case 'arrow-right': {
      // Arrow right icon
      const line = svgEl('line', { x1: '5', y1: '12', x2: '19', y2: '12' });
      const poly = svgEl('polyline', { points: '12 5 19 12 12 19' });
      svg.append(line, poly);
      break;
    }

    default: {
      const circle = svgEl('circle', { cx: '12', cy: '12', r: '10' });
      svg.appendChild(circle);
      break;
    }
  }

  return svg;
}
