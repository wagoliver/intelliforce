/* eslint-disable */
// @ts-nocheck
import type { ReactNode } from "react";

export const I: Record<string, ReactNode> = {
  back: <path d="M10 4l-4 4 4 4M6 8h8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  plus: <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>,
  trash: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M3 5h10M5 5V3.5h6V5M5.5 5l.5 8h4l.5-8"/></g>,
  close: <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none"/>,
  play: <path d="M5 3l8 5-8 5z" fill="currentColor"/>,
  copy: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="5" y="5" width="8" height="8" rx="1"/><path d="M11 5V3.5a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5v7a.5.5 0 0 0 .5.5H5"/></g>,
  doc: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M4 2.5h6l3 3V13a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z M10 2.5V5.5h3"/></g>,
  upload: <g stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"><path d="M8 11V3M5 6l3-3 3 3M3 13h10"/></g>,
  sql: <g stroke="currentColor" strokeWidth="1.4" fill="none"><ellipse cx="8" cy="4" rx="5" ry="1.5"/><path d="M3 4v8c0 .8 2.2 1.5 5 1.5s5-.7 5-1.5V4 M3 8c0 .8 2.2 1.5 5 1.5s5-.7 5-1.5"/></g>,
  web: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11M8 2.5c2 1.8 2 9.2 0 11M8 2.5c-2 1.8-2 9.2 0 11"/></g>,
  cap: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M8 2.5l5 2.5v3c0 3-2 5.5-5 6.5-3-1-5-3.5-5-6.5V5l5-2.5z"/></g>,
  webhook: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="5" cy="11" r="2"/><circle cx="11" cy="5" r="2"/><circle cx="11" cy="11" r="2"/><path d="M6.5 9.5l3-3M9 11h0"/></g>,
  queue: <g stroke="currentColor" strokeWidth="1.4" fill="none"><rect x="2.5" y="3" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="6.75" width="11" height="2.5" rx="0.5"/><rect x="2.5" y="10.5" width="11" height="2.5" rx="0.5"/></g>,
  cron: <g stroke="currentColor" strokeWidth="1.4" fill="none"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 2"/></g>,
  event: <g stroke="currentColor" strokeWidth="1.4" fill="none"><path d="M9 2.5L4 9h4l-1 4.5L12 7H8z"/></g>,
  expand: <path d="M11 4l-3 4 3 4M5 4l-3 4 3 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  collapse: <path d="M5 4l3 4-3 4M11 4l3 4-3 4" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
  chev: <path d="M5 7l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none"/>,
};

export const Svg = ({ name, ...rest }: any) => (
  <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" {...rest}>{I[name]}</svg>
);
