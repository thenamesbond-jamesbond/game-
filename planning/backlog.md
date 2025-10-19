# Feature Backlog

> Prioritize by impact vs effort. Use MoSCoW (Must/Should/Could/Won't for now).

| ID | Feature | Description | Priority | Effort | Status | Notes |
|----|---------|-------------|----------|--------|--------|-------|
| F-001 | Wall Jump | Add wall-detect and jump when player is adjacent to eligible wall surfaces. | Must | M | Todo | Confirm eligibility (tagged walls vs any), input behavior, limits/cooldown, and platforms. |
| F-002 | Coin Persistence (Normal Mode) | Persist coins on death in Normal mode; maintain running total across runs. | Must | S | Todo | Define storage (localStorage vs backend later). Consider anti-dup safeguards. |
| F-003 | Shop: Spend Coins | Implement shop UI/flow to spend coins on items/upgrades/classes. | Must | M | Todo | Define purchasables, pricing, single vs repeatable purchases, and atomic updates. |
| F-004 | Powerups Framework | System to define timed/stackable powerups and basic HUD indicators. | Should | M | Todo | v1 candidates: speed, shield, magnet. Define acquisition and stacking rules. |
| F-005 | RPG Mode v1 (Classes + XP) | XP and coins feed into upgraded player classes; save/load progress. | Should | L | Todo | Define initial classes, upgrade tiers, caps, and persistence scope for v1. |

## Prioritization Rubric (brief)
- **Impact**: player value, retention, revenue.
- **Effort**: engineering + art + design complexity.
- **Risk**: uncertainty or dependency heaviness.
