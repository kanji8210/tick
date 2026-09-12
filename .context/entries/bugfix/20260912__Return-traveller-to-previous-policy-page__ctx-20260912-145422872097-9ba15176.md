---
entry_id: "ctx-20260912-145422872097-9ba15176"
title: "Return traveller to previous policy page"
category: "bugfix"
tags: ["navigation", "quote-wizard", "history", "onboarding"]
files: ["src/App.jsx", "src/components/QuoteWizard.jsx"]
commits: ["3928e11"]
status: "active"
importance: "medium"
created_at: "2026-09-12T14:54:22Z"
updated_at: "2026-09-12T14:54:23Z"
summary: "Fixed quote-wizard Back navigation so applications opened from a policy return to that exact policy instead of showing the plan list."
retrieval_hints: "traveller quote back previous policy popstate history policy ID"
---

## What
Passed the app history callback into QuoteWizard, used it for step-three Back when an initial policy exists, and updated popstate handling to restore the stored history entry and policy ID.

## Why
The traveller-details Back button always hard-coded step 2, and the prior popstate fallback reconstructed /policy without its policy ID.

## Impact
The verified landing-to-policy-to-quote flow now returns to the same policy page. Direct quote journeys retain step-based Back navigation.
