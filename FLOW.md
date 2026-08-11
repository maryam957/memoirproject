# Onboarding flow specification

**Owner path only.** From first arrival to an account existing. The
contributor's experience of opening the link, memory capture, transcription,
chapter organization, publishing and comments are all out of scope.

The required order is *onboarding → authentication*. Within that, the shape
below is a set of decisions, and the reasoning for each is in the code
comments on the screen it belongs to.

## The shape

| # | Screen | Route | Asks for | Required | Writes |
| --- | --- | --- | --- | --- | --- |
| 0 | Arrival | `/` | Nothing | — | — |
| 1 | Who is this story about? | `/onboarding/about` | Relationship, and pronoun where it isn't implied | No | `contributors.relationship_to_subject` (inverted), event metadata |
| 2 | What's her name? | `/onboarding/name` | The subject's name | **Yes** | `memoirs.subject_name`, `memoirs.share_slug` |
| 3 | Is Nadia still with us? | `/onboarding/life` | Living or remembering, and roughly when | No | `memoirs.subject_birth_date`, `memoirs.subject_death_date` |
| 4 | How would you describe her in one line? | `/onboarding/line` | The dedication | No | `memoirs.short_description` |
| 5 | Here's the beginning of her story | `/onboarding/cover` | Nothing — it shows the result | — | — |
| 6 | Save her story | `/account` | Email, password | **Yes** | `auth.users`, `profiles`, `memoirs`, `contributors`, `analytics_events` |
| 7 | It exists now | `/welcome` | Nothing | — | — |

`/sign-in` completes the authentication surface for someone coming back.

## Decisions, and why

**Authentication is last, and the flow says so on the first screen.** "No
account needed yet" is on the landing page because the objection people arrive
with is *how much is this going to cost me before I know what it is*. By the
time the account is asked for, the person has made something with their name
on it, and the request reads as keeping it rather than as a toll.

**One question per screen.** The heading is the question; there is no form
label anywhere in the flow. This is the pattern every later feature inherits,
and it is what makes a five-step sequence feel shorter than a one-page form
with five fields.

**Every screen fits one viewport.** The flow is a fixed-height column — header,
question, action — rather than a page with a floating bar, so nothing scrolls
and the button never moves between steps. Where a screen would not fit, the
content gives way rather than the layout: the type scale steps down below
740px of height, the cover is sized in `vh` and holds a portrait ratio, and the
landing page's three-line explainer only appears when there is height going
spare. Measured at 1440×900, 1280×720, 430×932 and 390×844: zero scroll on
every screen.

**Only two answers are required — the name, and the account.** Everything
else can be skipped, because the cost of somebody abandoning at step three is
much higher than the cost of a memoir that starts out thin. A skipped
dedication still produces a `short_description` (that column is NOT NULL), and
the substitute line states only what it was told.

**The easiest question is first.** Step one is six cards and a tap. Nothing to
recall, nothing to type. The hardest question — describe them in one line — is
fourth, and skippable, by which point the person has momentum.

**The relationship carries the pronoun.** "My mother" gives the flow *her*, so
step two can ask "What's her name?" instead of "What's their name?". Cards
that imply nothing — *My partner*, *Someone else* — ask instead. The product
never infers gender from a name.

**Years are free text.** "1947", "the 1940s", "just after partition" — all
accepted, and what we understood is echoed back under the field. A calendar
widget demanding an exact date of death is a cruel thing to put in front of
somebody three weeks after a funeral, and people stall on the day while
knowing the year perfectly well.

**The dedication placeholder is a real example, not an instruction.** Seeing
somebody else's specific, slightly funny line about their grandmother is what
gives people permission to write their own instead of attempting a eulogy.

**Step five is the payoff.** Four answers become a bound book with their name
on it. It exists so that the account screen has something to protect —
otherwise the last screen is a signup form with no context.

**Visibility is not asked during onboarding.** It is a real decision with real
consequences, and asking it before anything exists to show produces a
guess. The strictest setting (`invited_only`, contributor comments) is the
default, and the console offers the rest.

**No billing.** The account and billing surfaces are separate from the product
surface. Nothing in this flow charges anybody, and no `subscriptions` row is
written.

## Where the answers live before the account exists

In `localStorage`, under `memoir.onboarding.draft.v1`, and nowhere else. There
is no owner to attach a memoir to until authentication completes, and somebody
who abandons the flow should not leave rows behind. A closed tab, a phone that
rings, a sibling who has to be asked about a date — none of those cost the
answers already given. On successful sign-up the draft is cleared, because it
has become rows.

## What the last screen writes

One transaction, in this order:

1. `auth.users` — Supabase Auth, on sign-up
2. `profiles` — `display_name`
3. `memoirs` — subject, dates, dedication, share slug, hashed invitation token,
   `status = 'collecting'`, `access_mode = 'invited_only'`
4. `contributors` — the owner is contributor number one, with their consent
   timestamp
5. `analytics_events` — one `memoir_created` event

Full mapping, including the two places it approximates: [`db/README.md`](db/README.md).
