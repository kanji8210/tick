---
entry_id: "ctx-20260824-090105095330-59a0d7d6"
title: "Light mode default and cross-page contrast audit"
category: "feature"
tags: ["theme", "light-mode", "accessibility", "contrast", "wcag"]
files: ["index.html", "src/App.jsx", "src/components/Header.jsx", "src/components/QuoteWizard.jsx", "src/components/GroupQuotesPage.jsx", "src/index.css"]
commits: []
status: "active"
importance: "medium"
created_at: "2026-08-24T09:01:05Z"
updated_at: "2026-08-24T09:01:05Z"
summary: "Made light mode the default across the SPA while preserving explicit saved dark-mode preferences, then audited and repaired contrast across all public routes, policy detail, mobile navigation, and dashboard fallback."
retrieval_hints: "light mode default tic-theme contrast audit WCAG semantic colors quote controls footer badges"
---

## What
Added pre-paint theme initialization, changed React and header fallbacks to light, darkened the light gold token, remapped dark-theme semantic colors in light mode, and added scoped fixes for quote controls and the group quote back action.

## Why
Fresh visits defaulted to dark and multiple inline dark-theme colors failed WCAG AA when displayed on light cards and page backgrounds.

## Impact
New users see light mode without a flash; explicit dark preference persists; audited text and controls meet AA contrast in tested public and fallback states.
