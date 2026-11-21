/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions":["node","node-addons"]}
 */
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { NativeToggle } from './NativeToggle';

jest.mock('obsidian', () => ({
  ToggleComponent: class {
    toggleEl: HTMLInputElement;
    private callback?: (value: boolean) => void;

    constructor(element: HTMLElement) {
      element.empty = () => element.replaceChildren();
      this.toggleEl = element.ownerDocument.createElement('input');
      this.toggleEl.type = 'checkbox';
      this.toggleEl.addEventListener('change', () => this.callback?.(this.toggleEl.checked));
      element.appendChild(this.toggleEl);
    }

    setValue(value: boolean) {
      if (this.toggleEl.checked !== value) {
        this.toggleEl.checked = value;
        this.callback?.(value);
      }
      return this;
    }

    onChange(callback: (value: boolean) => void) {
      this.callback = callback;
      return this;
    }
  },
}), { virtual: true });

it('ignores native notifications while displaying saved values and handles user clicks', () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const onChange = jest.fn();
  const display = (value: boolean) =>
    act(() => render(h(NativeToggle, { label: 'Open imported note', value, onChange }), container));

  try {
    display(true);
    expect(container.querySelector('input')?.checked).toBe(true);
    expect(onChange).not.toHaveBeenCalled();

    display(false);
    expect(container.querySelector('input')?.checked).toBe(false);
    expect(onChange).not.toHaveBeenCalled();

    act(() => container.querySelector('input')?.click());
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => container.querySelector('input')?.click());
    expect(onChange).toHaveBeenCalledTimes(2);
  } finally {
    act(() => render(null, container));
    container.remove();
  }
});
