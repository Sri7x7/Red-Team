// @ts-check
/**
 * @file public/js/dom.js
 * @description Safe DOM creation helper adhering strictly to strict CSP standards.
 */

/**
 * Creates an HTMLElement with attributes, event listeners, and child nodes.
 * Strictly uses textContent and safe DOM nodes.
 * @param {string} tag - HTML tag name
 * @param {Record<string, any>} [props] - Properties and attributes
 * @param {...any} children - Child elements or text
 * @returns {HTMLElement}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  if (props && typeof props === 'object') {
    for (const [key, val] of Object.entries(props)) {
      if (val === undefined || val === null) continue;

      if (key.startsWith('on') && typeof val === 'function') {
        const eventName = key.slice(2).toLowerCase();
        el.addEventListener(eventName, val);
      } else if (key === 'className' || key === 'class') {
        el.className = String(val);
      } else if (key === 'textContent' || key === 'text') {
        el.textContent = String(val);
      } else if (key === 'dataset' && typeof val === 'object') {
        for (const [dataKey, dataVal] of Object.entries(val)) {
          el.dataset[dataKey] = String(dataVal);
        }
      } else if (key === 'styleProps' && typeof val === 'object') {
        // Safe CSS variable or style property setting via element.style.setProperty
        for (const [styleName, styleVal] of Object.entries(val)) {
          el.style.setProperty(styleName, String(styleVal));
        }
      } else if (typeof val === 'boolean') {
        if (val) {
          el.setAttribute(key, '');
        }
      } else {
        el.setAttribute(key, String(val));
      }
    }
  }

  const flatChildren = children.flat(Infinity);
  for (const child of flatChildren) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  }

  return el;
}

/**
 * Removes all child nodes from an element.
 * @param {HTMLElement} el
 */
export function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}
