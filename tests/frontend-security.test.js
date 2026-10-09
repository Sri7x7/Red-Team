// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Recursively retrieves all files in a directory.
 * @param {string} dir
 * @returns {Array<string>}
 */
function getAllFiles(dir) {
  let results = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const fullPath = join(dir, file);
    const stat = statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Frontend CSP & Security Auditing (public/)', () => {
  const publicDir = join(process.cwd(), 'public');
  const allFiles = getAllFiles(publicDir);

  it('contains no innerHTML usage in any frontend file', () => {
    for (const file of allFiles) {
      if (file.endsWith('.js') || file.endsWith('.html')) {
        const content = readFileSync(file, 'utf-8');
        assert.ok(
          !content.includes('innerHTML'),
          `Forbidden innerHTML found in ${file}`
        );
      }
    }
  });

  it('contains no inline style attributes (style="") in markup or code', () => {
    for (const file of allFiles) {
      if (file.endsWith('.js') || file.endsWith('.html')) {
        const content = readFileSync(file, 'utf-8');
        // Check for style="" or style=''
        const match = content.match(/\bstyle\s*=\s*["'][^"']*["']/i);
        assert.equal(
          match,
          null,
          `Forbidden inline style attribute found in ${file}: ${match?.[0]}`
        );
      }
    }
  });

  it('contains no setAttribute("style", ...) calls in javascript files', () => {
    for (const file of allFiles) {
      if (file.endsWith('.js')) {
        const content = readFileSync(file, 'utf-8');
        const match = content.match(/setAttribute\s*\(\s*['"]style['"]/i);
        assert.equal(
          match,
          null,
          `Forbidden setAttribute('style') found in ${file}`
        );
      }
    }
  });

  it('contains no inline event handler attributes (onclick, onsubmit, etc.) in index.html', () => {
    const htmlPath = join(publicDir, 'index.html');
    const content = readFileSync(htmlPath, 'utf-8');
    // Match attributes like onclick=, onchange=, onsubmit=
    const inlineHandlerMatch = content.match(/\son[a-z]+\s*=\s*["'][^"']*["']/i);
    assert.equal(
      inlineHandlerMatch,
      null,
      `Forbidden inline event handler found in index.html: ${inlineHandlerMatch?.[0]}`
    );
  });

  it('contains no inline script tags with embedded executable code in index.html', () => {
    const htmlPath = join(publicDir, 'index.html');
    const content = readFileSync(htmlPath, 'utf-8');
    // Match any <script> that does not have a src attribute
    const scriptMatches = content.match(/<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi);
    assert.equal(
      scriptMatches,
      null,
      `Forbidden inline executable script block found in index.html: ${scriptMatches?.[0]}`
    );
  });
});
