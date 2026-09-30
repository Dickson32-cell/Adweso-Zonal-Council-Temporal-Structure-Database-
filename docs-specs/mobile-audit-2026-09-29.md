# Mobile navigation audit — adweso-register (adweso-test branch)

**Date:** Sep 29 2026 · Skill applied: mobile-navigation-patterns · Method: code map (719-line RegisterTable + TopBar + globals.css) then live device-viewport checks on local Next server.

## Feature inventory (all must be reachable on phone)
Filters (search, area, status chips) · New Record form (serial preview, GPS pick, 7 fields) · record detail (money, payment history, map link) · Edit (admin direct / staff approval queue) · Pay (part payment) · Mark Paid · Delete (admin) · Bill tickbox + Print Bills (selected) · Bills for All (filtered) · Export Excel · Print List · per-area summary · grand totals · TopBar (Staff/Edits/Passwords/Master links, Change Password panel, logout) · login + staff registration pages.
## Findings from code
- Breakpoint is 639px (NOT 768) — `.only-mobile`/.only-desktop helpers.
- Modal cards fixed width 460/440/380 inline — CSS override at ≤639 saves them; verify live.
- TopBar links: inline ghost buttons, wrap on phone — check tap sizes (btn-sm padding 5px 10px ≈ 28px tall < 44px target).
- No dynamic viewport (100dvh) anywhere — keyboards may cover inputs in modals.
- Tablet band (640–1024) exists but thin; desktop table shows at 640px exactly — 7" tablets get the wide table (per skill: tables are desktop-only).
- No bottom tab bar — all nav via TopBar; document as intentional (desktop-style nav on mobile, acceptable for a 2-role tool) or fix.
## Live checks (fill after browser run)
- [ ] 390×844 (iPhone 14): header, filters, cards, modals fully usable
- [ ] 360×740 (Android): same
- [ ] 320×568 (iPhone SE): no horizontal scroll
- [ ] 768×1024 (iPad portrait): desktop table = correct remap
- [ ] TopBar links ≥44px tap height
- [ ] Modals scroll within viewport, inputs reachable when keyboard open
- [ ] Print Bills / Bills for All / New Record visible above the fold