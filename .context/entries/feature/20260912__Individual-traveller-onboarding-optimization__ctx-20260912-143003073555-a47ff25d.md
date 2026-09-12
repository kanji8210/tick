---
entry_id: "ctx-20260912-143003073555-a47ff25d"
title: "Individual traveller onboarding optimization"
category: "feature"
tags: ["onboarding", "quote-wizard", "individual-traveller", "mobile", "ux"]
files: ["src/components/Hero.jsx", "src/components/QuoteWizard.jsx"]
commits: ["3928e11"]
status: "active"
importance: "medium"
created_at: "2026-09-12T14:30:03Z"
updated_at: "2026-09-12T14:30:03Z"
summary: "Reviewed and improved the end-to-end individual traveller quote journey, preserving search context, reducing plan overload, clarifying loading and required states, and fixing quote restart state."
retrieval_hints: "individual traveller onboarding hero search handoff quote wizard plan pagination required fields origin country restart"
---

## What
Updated Hero and QuoteWizard so all users retain destination and date inputs, origin country reaches the sale mutation, plan selection starts with six price-sorted choices and progressive disclosure, selected-plan loading is explicit, required traveller and checkout fields gate submission, and restart restores the full current form shape.

## Why
Browser click-through found lost search context for logged-in users, a blank selected-plan summary during loading, 49 plans rendered at once on mobile, a visible origin field omitted from submission, and obsolete reset keys after success.

## Impact
The individual flow is shorter and clearer on mobile, preserves user input, prevents incomplete submissions, and restarts reliably. ESLint, Vite build, and Playwright interaction checks passed.

## Notes
The Vite app was verified at http://localhost:5173/index.html. Existing build chunk-size warnings remain.
