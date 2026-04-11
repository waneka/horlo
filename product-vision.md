# 🕰️ Watch Collection App — Product Spec (MVP + Taste-Aware System)

## 1. Purpose

A web application for managing a personal watch collection and wishlist, focused on:

> Helping users make better, more intentional collecting decisions.

This is not a cataloging tool. It is a **taste-aware collection intelligence system**.

---

## 2. Core Product Principles

* **Decision > storage**
* **Taste-aware > generic logic**
* **Simple inputs → meaningful insights**
* **Personal first, social later**
* **Guidance, not judgment**

---

## 3. Core Entities

---

### 3.1 Watch

```ts
type Watch = {
  id: string

  brand: string
  model: string
  reference?: string

  status: 'owned' | 'wishlist' | 'sold' | 'grail'

  pricePaid?: number
  targetPrice?: number
  marketPrice?: number

  movement: 'automatic' | 'manual' | 'quartz' | 'spring-drive' | 'other'
  complications: string[] // ['date', 'gmt', 'chrono']

  caseSizeMm?: number
  lugToLugMm?: number
  waterResistanceM?: number

  strapType?: 'bracelet' | 'leather' | 'rubber' | 'nato' | 'other'

  dialColor?: string // 'black', 'blue', 'white', etc.

  // Categorization
  styleTags: string[]     // ['diver', 'dress', 'field', 'pilot', 'gada']
  designTraits: string[]  // ['heritage', 'vintage-inspired', 'domed-crystal', 'minimal']
  roleTags: string[]      // ['daily', 'travel', 'weekend', 'formal', 'beater']

  acquisitionDate?: string
  lastWornDate?: string

  notes?: string
  imageUrl?: string
}
```

---

### 3.2 User Preferences (Critical for Intelligence Layer)

```ts
type UserPreferences = {
  preferredStyles: string[]
  dislikedStyles: string[]

  preferredDesignTraits: string[]
  dislikedDesignTraits: string[]

  preferredComplications: string[]
  complicationExceptions: string[] // e.g. ['gmt'] = always allowed

  preferredDialColors: string[]
  dislikedDialColors: string[]

  preferredCaseSizeRange?: {
    min: number
    max: number
  }

  overlapTolerance: 'low' | 'medium' | 'high'

  collectionGoal?: 
    | 'balanced'
    | 'specialist'
    | 'variety-within-theme'

  notes?: string // freeform taste description
}
```

---

## 4. MVP Feature Set

---

### 4.1 Watch Management (CRUD)

#### Description

Create, update, and manage watches across all statuses.

#### User Stories

* Add a watch I own
* Add a watch to wishlist
* Edit details over time
* Move wishlist → owned
* Mark watch as sold

#### Requirements

* Manual input only
* Status is required
* Tagging required (at least 1 style + 1 role)
* Image optional

---

### 4.2 Unified Collection View (Grid)

#### Description

Primary UI for browsing watches visually.

#### Features

* Card layout
* Each card shows:

  * Image
  * Brand + model
  * Key specs (case size, movement, WR)
* Toggle:

  * Owned / Wishlist / All

#### Filters

* Status
* Style tags
* Role tags
* Dial color

#### User Stories

* Browse collection visually
* Compare watches at a glance
* Filter down to specific categories

---

### 4.3 Tagging System (High Leverage)

#### Dimensions

* **Style** → what type of watch it is
* **Design Traits** → how it looks/feels
* **Role** → how it is used

#### Example Tags

* Style: diver, dress, field, pilot, gada
* Design: heritage, vintage-inspired, tooly, minimal, sporty
* Role: daily, travel, weekend, formal, beater

#### User Stories

* Categorize watches meaningfully
* Reflect real-world usage, not just specs

---

### 4.4 User Preferences (MVP Version)

#### Description

Lightweight configuration of collecting taste.

#### Inputs (MVP)

* Preferred styles
* Disliked styles
* Preferred design traits
* Disliked design traits
* Preferred complications
* “Always allowed” complications (exceptions)
* Dial color preferences
* Overlap tolerance

#### User Stories

* Express personal taste
* Prevent irrelevant suggestions
* Customize overlap logic

---

### 4.5 Collection Balance Analysis

#### Description

Surface distribution of collection across tags.

#### Outputs

* Style distribution
* Role distribution
* Dial color distribution

#### Example Insights

* “80% of your collection is daily wear”
* “No formal/dress watches in collection”
* “Mostly neutral dial colors”

#### User Stories

* Understand collection composition
* Identify gaps or biases

---

### 4.6 Similarity & Role Analysis (Replaces “Overlap Detection”)

#### Description

Evaluate how a watch relates to the existing collection.

---

### 4.6.1 Layer 1 — Objective Similarity

System evaluates:

* styleTags overlap
* designTraits overlap
* dialColor
* complications
* case size range (soft signal)
* strap type
* WR band

Output:

* similarity score (internal only)

---

### 4.6.2 Layer 2 — Functional Overlap

Based on roleTags:

* Does it serve the same purpose?
* Would it compete for wrist time?

Example:

* Two different watches both tagged “daily” → functional overlap

---

### 4.6.3 Layer 3 — Preference Adjustment

Adjust interpretation using UserPreferences:

* Preferred styles → reduce penalty
* Disliked traits → increase penalty
* Exception complications → ignore overlap
* Overlap tolerance modifies thresholds

---

### 4.6.4 Output Labels (User-Facing)

Avoid raw scores. Use semantic labels:

* **Core Fit** — highly aligned with your taste
* **Familiar Territory** — similar to what you like
* **Role Duplicate** — likely same wrist-time role
* **Taste Expansion** — new but still aligned
* **Outlier** — unusual for your collection
* **Hard Mismatch** — conflicts with stated dislikes

---

#### User Stories

* Understand whether a watch adds something new
* Avoid redundant purchases (when desired)
* Intentionally double down on a style (when desired)

---

### 4.7 Wishlist Intelligence (Lightweight)

#### Features

* Target price input
* Manual “good deal” flag

#### Future-ready structure for:

* price tracking
* deal alerts

#### User Stories

* Track buying intent
* Make wishlist actionable

---

### 4.8 Wear Tracking (Minimal)

#### Features

* “Mark as worn today”
* Store `lastWornDate`

#### Derived Insight

* “Haven’t worn in X days”

#### User Stories

* Understand real usage
* Inform future purchases

---

## 5. UI / UX Structure

---

### 5.1 Primary Views

#### Grid View (default)

* Card-based
* Filter chips
* Status toggle

#### Watch Detail View

* Full metadata
* Tags
* Notes
* Similarity / role analysis

#### Insights Panel

* Collection balance
* Wear insights
* Basic recommendations (later)

---

## 6. Non-Goals (MVP)

* No external APIs
* No authentication system required
* No social features
* No automated price tracking
* No AI-driven decisions (yet)

---

## 7. Future Features

---

### 7.1 AI Recommendation Engine

#### Goal

Suggest what to buy next.

#### Inputs

* Collection
* Wishlist
* Preferences
* Tag distribution
* Wear history (optional)

#### Outputs

* “Best gap filler”
* “Most versatile addition”
* “Most unique vs collection”
* “Best rule-breaking exception”

#### Approach

* Phase 1: rule-based scoring
* Phase 2: AI explanation layer
* Phase 3: learned recommendations

---

### 7.2 AI-Assisted Similarity Interpretation

AI generates human-readable reasoning:

Example:

> “This overlaps with your existing collection in vintage sport-watch aesthetic, but adds meaningful differentiation through its GMT functionality and slimmer travel profile.”

---

### 7.3 Social / Community Layer

#### Features

* Public collections
* Follow users
* Activity feed

#### User Stories

* Discover watches through others
* Compare taste profiles
* Get inspiration

---

### 7.4 Price & Deal Tracking

#### Features

* Historical pricing
* Alerts when below target
* Integration with marketplaces

---

### 7.5 Collection Visualization Map

#### Concept

2D plot:

* X: Dressy ↔ Sporty
* Y: Affordable ↔ Expensive

#### Value

* Instantly see gaps

---

## 8. Technical Notes

---

### Storage (MVP)

* Local-first (localStorage or lightweight DB)
* No backend required initially

---

### Extensibility

* Tags should be flexible
* Schema should allow additional fields without migration friction

---

### Performance

* Target: <500 watches per user

---

## 9. MVP Success Criteria

User can:

* Add and manage watches
* View collection visually
* Understand collection balance
* See meaningful similarity insights
* Avoid (or intentionally embrace) overlap

---

## 10. Strategic Positioning

This product is:

> A **taste-aware decision engine for watch collectors**

Not:

* a spreadsheet replacement
* a spec database
* a marketplace

---

## 11. Next Implementation Steps

1. Define TypeScript models (Watch, UserPreferences)
2. Build CRUD + grid UI
3. Implement tagging system
4. Add preferences UI
5. Build similarity engine (rule-based)
6. Add insights panel

---

If needed next:

* component architecture (React + state)
* similarity scoring algorithm (detailed weights)
* initial seed dataset for tags + traits
