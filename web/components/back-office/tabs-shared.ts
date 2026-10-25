import type { KeyboardEvent } from 'react';

/** One entry of `PillTabs` / `UnderlineTabs`. `count` renders only when the caller passes a server number. */
export interface TabItem {
  key: string;
  label: string;
  count?: number;
  /** Required in `mode="link"`. */
  href?: string;
}

/** The props `PillTabs` and `UnderlineTabs` share (HO-P4 §11.1). */
export interface TabsProps {
  /** The tablist's / nav's accessible name. */
  label: string;
  items: TabItem[];
  /** The `key` of the current item. */
  value?: string;
  /** `mode="state"` only: called with the chosen item's `key`. */
  onChange?: (key: string) => void;
  /** `state` = in-page switcher (`role=tablist`); `link` = route section nav (`<nav>` + links). */
  mode: 'state' | 'link';
}

/** Arrow / Home / End move focus between the tabs of a roving-tabindex tablist and select the target. */
export function handleTablistKeyDown(
  event: KeyboardEvent<HTMLElement>,
  keys: readonly string[],
  current: number,
  onChange?: (key: string) => void,
) {
  let next = current;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % keys.length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
    next = (current - 1 + keys.length) % keys.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = keys.length - 1;
  else return;
  event.preventDefault();
  const tabs = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
  tabs?.[next]?.focus();
  const nextKey = keys[next];
  if (nextKey !== undefined) onChange?.(nextKey);
}
