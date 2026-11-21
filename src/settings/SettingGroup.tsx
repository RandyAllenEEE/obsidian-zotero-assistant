import React from 'react';
import { createPortal } from 'react-dom';
import { createSettingsList } from './settings-list';
import { ComponentChild } from 'preact';

interface SettingGroupProps {
  children: ComponentChild;
  level?: number;
}

/**
 * SettingGroup component for organizing related settings with visual hierarchy.
 * Creates indented containers with left-border styling for multi-level organization.
 * 
 * @param children - Settings items to group
 * @param level - Nesting level for indentation (default: 1)
 */
export function SettingGroup({ children, level = 1 }: SettingGroupProps) {
  const [list, setList] = React.useState<HTMLElement | null>(null);
  const mount = React.useCallback((container: HTMLDivElement | null) => {
    if (container) setList(createSettingsList(container));
  }, []);
  return (
    <div className={`zt-setting-group zt-setting-group-level-${level}`} ref={mount}>
      {list && createPortal(<>{children}</>, list)}
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ComponentChild;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <details className="assistant-module-frame zt-settings-section">
      <summary className="assistant-settings-section-header">{title}</summary>
      <div>
        {description && <div className="setting-item-description zt-settings-section-description">{description}</div>}
        {children}
      </div>
    </details>
  );
}
