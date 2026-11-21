import { ToggleComponent } from 'obsidian';
import React from 'react';

export function NativeToggle({ label, value, onChange }: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  const mount = React.useRef<HTMLSpanElement>(null);
  const control = React.useRef<ToggleComponent | null>(null);
  const displayedValue = React.useRef(value);
  const callback = React.useRef(onChange);
  callback.current = onChange;

  React.useLayoutEffect(() => {
    const element = mount.current;
    if (!element) return;
    control.current = new ToggleComponent(element).onChange(next => {
      if (next === displayedValue.current) return;
      displayedValue.current = next;
      callback.current();
    });
    return () => {
      control.current = null;
      element.empty();
    };
  }, []);

  React.useLayoutEffect(() => {
    // Obsidian can notify onChange when setValue updates an existing toggle.
    displayedValue.current = value;
    control.current?.setValue(value);
    control.current?.toggleEl.setAttribute('aria-label', label);
  }, [value, label]);

  return React.createElement('span', { ref: mount });
}
