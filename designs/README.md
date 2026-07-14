# Copo — App Designs

Standalone, self-contained HTML deliverables for the Copo mobile app (KSA coupons).
Core concept: every store is a **4-level coupon journey** — enter at Level 1 with its coupons
open, Levels 2–4 locked behind bigger discounts, and **buy 2 coupons in a level to unlock the next**
(a level with a single coupon needs just that one).

Open any file directly in a browser — no build step, no external dependencies.

| File | What it is |
|------|------------|
| [copo-wireframes-grayscale.html](copo-wireframes-grayscale.html) | Annotated **grayscale wireframes** — layout & structure, with numbered UX/UI notes and "Why this layout?" panels. |
| [copo-hifi-mockups.html](copo-hifi-mockups.html) | **Hi-fi mockups** — full color (coral #FF4D4F, gold #FFC24B), light theme, all 21 screens. |
| [copo-interactive-prototype.html](copo-interactive-prototype.html) | **Interactive prototype** — a working, clickable single-device build; the level-unlock loop, cart, checkout (card / Apple Pay) and Orders all function. |

## Flow covered
Onboarding (slides → phone OTP → location) → Home / Market → Store level-journey → Cart → Checkout → Payment → Success.

## Store edge cases
- **Barn's Café** — many coupons per level
- **Lumière Cinema** — one coupon per level
- **Nuss Nuss Café** — all levels open (no gate)
- **Burger Lab** — starts already at Level 2 / reached-a-new-level celebration

_Nav shows Home · Market · Orders · Profile; Home & Market are the built tabs._
