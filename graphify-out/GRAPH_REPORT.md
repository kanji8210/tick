# Graph Report - src  (2026-04-15)

## Corpus Check
- Corpus is ~47,188 words - fits in a single context window. You may not need a graph.

## Summary
- 126 nodes · 148 edges · 16 communities detected
- Extraction: 74% EXTRACTED · 26% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Shared UI Components|Shared UI Components]]
- [[_COMMUNITY_Auth & Navigation|Auth & Navigation]]
- [[_COMMUNITY_Policy Comparison Engine|Policy Comparison Engine]]
- [[_COMMUNITY_Insured Dashboard & Detail|Insured Dashboard & Detail]]
- [[_COMMUNITY_Agent Dashboard|Agent Dashboard]]
- [[_COMMUNITY_Policy Showcase Grid|Policy Showcase Grid]]
- [[_COMMUNITY_Insurance Partners|Insurance Partners]]
- [[_COMMUNITY_Quote Wizard Flow|Quote Wizard Flow]]
- [[_COMMUNITY_Notification Panel|Notification Panel]]
- [[_COMMUNITY_App Router Shell|App Router Shell]]
- [[_COMMUNITY_Policy Verification|Policy Verification]]
- [[_COMMUNITY_Product Catalog|Product Catalog]]
- [[_COMMUNITY_GraphQL Client|GraphQL Client]]
- [[_COMMUNITY_App Entry Point|App Entry Point]]
- [[_COMMUNITY_React Framework|React Framework]]
- [[_COMMUNITY_Vite Bundler|Vite Bundler]]

## God Nodes (most connected - your core abstractions)
1. `useResponsive()` - 25 edges
2. `useAuth()` - 14 edges
3. `Insurance Partners` - 9 edges
4. `PolicyDetail()` - 6 edges
5. `BenefitModal()` - 6 edges
6. `QuoteWizard()` - 6 edges
7. `AgentDashboard()` - 4 edges
8. `CompareModal()` - 4 edges
9. `AgenciesPage()` - 3 edges
10. `Hero()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `CompareBar()` --calls--> `useResponsive()`  [INFERRED]
  src\components\LandingPage.jsx → src\lib\useResponsive.js
- `InsurerProfileModal()` --calls--> `useResponsive()`  [INFERRED]
  src\components\PolicyShowcase.jsx → src\lib\useResponsive.js
- `PolicyShowcase()` --calls--> `useResponsive()`  [INFERRED]
  src\components\PolicyShowcase.jsx → src\lib\useResponsive.js
- `AboutPage()` --calls--> `useResponsive()`  [INFERRED]
  src\components\AboutPage.jsx → src\lib\useResponsive.js
- `AgenciesPage()` --calls--> `useResponsive()`  [INFERRED]
  src\components\AgenciesPage.jsx → src\lib\useResponsive.js

## Hyperedges (group relationships)
- **Kenyan Insurance Partners** — aar_insurance, britam_insurance, cic_insurance, heritage_insurance, jubilee_insurance, orient_insurance, resolution_insurance, uap_insurance [EXTRACTED 1.00]

## Communities

### Community 0 - "Shared UI Components"
Cohesion: 0.1
Nodes (10): AboutPage(), AssignClientModal(), CategoryFilters(), FAQSection(), Footer(), PolicyEditModal(), ProcessSection(), TrustedPartners() (+2 more)

### Community 1 - "Auth & Navigation"
Cohesion: 0.1
Nodes (10): AgenciesPage(), useAuth(), Dashboard(), Header(), Hero(), LandingPage(), Login(), Messaging() (+2 more)

### Community 2 - "Policy Comparison Engine"
Cohesion: 0.19
Nodes (8): CompareBar(), CompareDatePicker(), CompareModal(), findCommonBenefits(), keyWords(), normalizeBenefit(), policyHasBenefit(), tripDays()

### Community 3 - "Insured Dashboard & Detail"
Cohesion: 0.19
Nodes (6): fmtKES(), InsuredDashboard(), bracketPremium(), PolicyDetail(), toLines(), tripDays()

### Community 4 - "Agent Dashboard"
Cohesion: 0.2
Nodes (2): AgentDashboard(), fmtKES()

### Community 5 - "Policy Showcase Grid"
Cohesion: 0.25
Nodes (7): BenefitModal(), fmtPrice(), InsurerProfileModal(), minPremium(), parseTags(), PolicyShowcase(), stripHtml()

### Community 6 - "Insurance Partners"
Cohesion: 0.2
Nodes (10): AAR Insurance, Britam Insurance, CIC Group, Heritage Insurance, Insurance Partners, Jubilee Insurance, Maljani Hero Banner, Orient Insurance (+2 more)

### Community 7 - "Quote Wizard Flow"
Cohesion: 0.36
Nodes (4): bracketPremium(), fmt(), QuoteWizard(), tripDays()

### Community 8 - "Notification Panel"
Cohesion: 0.5
Nodes (1): NotificationPanel()

### Community 9 - "App Router Shell"
Cohesion: 0.67
Nodes (0): 

### Community 10 - "Policy Verification"
Cohesion: 1.0
Nodes (2): getStatusMeta(), VerifyPolicy()

### Community 11 - "Product Catalog"
Cohesion: 1.0
Nodes (0): 

### Community 12 - "GraphQL Client"
Cohesion: 1.0
Nodes (0): 

### Community 13 - "App Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 14 - "React Framework"
Cohesion: 1.0
Nodes (1): React Framework

### Community 15 - "Vite Bundler"
Cohesion: 1.0
Nodes (1): Vite Build Tool

## Knowledge Gaps
- **11 isolated node(s):** `AAR Insurance`, `Britam Insurance`, `CIC Group`, `Heritage Insurance`, `Jubilee Insurance` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Product Catalog`** (2 nodes): `Catalog()`, `Catalog.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `GraphQL Client`** (2 nodes): `getAuthHeaders()`, `graphql.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Entry Point`** (1 nodes): `main.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Framework`** (1 nodes): `React Framework`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vite Bundler`** (1 nodes): `Vite Build Tool`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useResponsive()` connect `Shared UI Components` to `Auth & Navigation`, `Policy Comparison Engine`, `Insured Dashboard & Detail`, `Agent Dashboard`, `Policy Showcase Grid`, `Quote Wizard Flow`, `Notification Panel`?**
  _High betweenness centrality (0.489) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Auth & Navigation` to `Notification Panel`, `Insured Dashboard & Detail`, `Agent Dashboard`, `Quote Wizard Flow`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Why does `AgentDashboard()` connect `Agent Dashboard` to `Shared UI Components`, `Auth & Navigation`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Are the 24 inferred relationships involving `useResponsive()` (e.g. with `AboutPage()` and `AgenciesPage()`) actually correct?**
  _`useResponsive()` has 24 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `useAuth()` (e.g. with `AgenciesPage()` and `AgentDashboard()`) actually correct?**
  _`useAuth()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `PolicyDetail()` (e.g. with `useResponsive()` and `fmtKES()`) actually correct?**
  _`PolicyDetail()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `AAR Insurance`, `Britam Insurance`, `CIC Group` to the rest of the system?**
  _11 weakly-connected nodes found - possible documentation gaps or missing edges._