import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import App from './App';
import { I18nProvider } from './i18n';
import { loadData } from './lib/storage';
import type { LifeOSData } from './types';

vi.mock('./lib/storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('./lib/storage')>();
  return { ...original, loadData: vi.fn() };
});

it('keeps the page and focused review field mounted during background refresh', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  window.localStorage.clear();
  const data: LifeOSData = { plans: [], tasks: [], reviews: [] };
  vi.mocked(loadData).mockResolvedValueOnce(data);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(I18nProvider, null, createElement(App))));
    const field = container.querySelector('textarea')!;
    field.focus();
    let finish!: (value: LifeOSData) => void;
    vi.mocked(loadData).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => (container.querySelector('button[title="Reload local data"]') as HTMLButtonElement).click());
    expect(container.querySelector('textarea')).toBe(field);
    expect(document.activeElement).toBe(field);
    expect(container.querySelector('.loading-state')).toBeNull();
    await act(async () => finish(data));
    expect(container.querySelector('textarea')).toBe(field);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
