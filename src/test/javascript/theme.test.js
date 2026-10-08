const fs = require('fs');
const path = require('path');
const { loadApp } = require('./setup/loadApp');

const CSS_PATH = path.resolve(__dirname, '../../main/resources/static/style.css');
const STORAGE_KEY = 'ops-dashboard.theme';

function click(document, id) {
  document.getElementById(id).dispatchEvent(new window.Event('click', { bubbles: true }));
}

function theme() {
  return document.documentElement.getAttribute('data-theme');
}

function toggle() {
  return document.getElementById('theme-toggle');
}

/** The CSS with comments removed, split into the theme blocks and everything else. */
function readCss() {
  const css = fs.readFileSync(CSS_PATH, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = {};
  const re = /([^{}]*\[data-theme="(light|dark)"\][^{}]*)\{([^}]*)\}/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    blocks[match[2]] = match[3];
  }
  return { blocks, rest: css.replace(re, '') };
}

function variableNames(block) {
  return (block.match(/--[\w-]+(?=\s*:)/g) || []).sort();
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme toggle', () => {
  test('AC-1: the header has a theme-toggle button', async () => {
    await loadApp();
    expect(toggle()).not.toBeNull();
    expect(toggle().tagName).toBe('BUTTON');
    expect(document.getElementById('app-header').contains(toggle())).toBe(true);
  });

  test('AC-4: with nothing stored the page is light and the button offers dark', async () => {
    await loadApp();
    expect(theme()).toBe('light');
    expect(toggle().textContent).toMatch(/dark/i);
  });

  test('AC-1: clicking switches to dark and back, and the label names the next theme', async () => {
    await loadApp();
    click(document, 'theme-toggle');
    expect(theme()).toBe('dark');
    expect(toggle().textContent).toMatch(/light/i);
    click(document, 'theme-toggle');
    expect(theme()).toBe('light');
    expect(toggle().textContent).toMatch(/dark/i);
  });

  test('AC-3: the choice is saved in localStorage', async () => {
    await loadApp();
    click(document, 'theme-toggle');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  test('AC-3: a stored dark theme is restored on load', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    await loadApp();
    expect(theme()).toBe('dark');
    expect(toggle().textContent).toMatch(/light/i);
  });

  test('an unknown stored value falls back to light', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'purple');
    await loadApp();
    expect(theme()).toBe('light');
  });

  test('the toggle works even when the API is unreachable', async () => {
    await loadApp({ failing: ['/api/health'] });
    click(document, 'theme-toggle');
    expect(theme()).toBe('dark');
  });
});

describe('theme stylesheet', () => {
  test('AC-2: colours live only in the theme blocks and the charts use variables', () => {
    const { blocks, rest } = readCss();
    expect(Object.keys(blocks).sort()).toEqual(['dark', 'light']);
    expect(rest).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    for (const selector of ['.chart-svg .bar', '.chart-svg .bar.warn', '.chart-svg .bar-label', '.chart-svg .bar-value']) {
      const escaped = selector.replace(/[.]/g, '\\.');
      const rule = rest.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
      expect(rule).not.toBeNull();
      expect(rule[1]).toMatch(/fill:\s*var\(--/);
    }
  });

  test('AC-2: the light and dark themes define the same variables', () => {
    const { blocks } = readCss();
    const light = variableNames(blocks.light);
    expect(light.length).toBeGreaterThan(0);
    expect(variableNames(blocks.dark)).toEqual(light);
  });
});
