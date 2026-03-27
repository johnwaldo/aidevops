# Retargeting Setup Guide

All custom audiences: **Ads Manager > Audiences > Create Audience > Custom Audience > [Source]**.

Sources: Website, Video, Facebook Page, Instagram Account, Lead Form, Customer List.

## Website Custom Audiences

**Setup:** Select pixel > choose event/URL rule > set retention window (1-180 days).

### Essential Website Audiences

| Audience | Configuration |
|----------|--------------|
| All Visitors 7d | All website visitors, 7 days |
| All Visitors 14d | All website visitors, 14 days |
| All Visitors 30d | All website visitors, 30 days |
| Product Viewers 14d | ViewContent event, 14 days |
| Cart Abandoners 7d | AddToCart, exclude Purchase, 7 days |
| Checkout Started 3d | InitiateCheckout, exclude Purchase, 3 days |
| Purchasers 30d | Purchase event, 30 days |
| Purchasers 180d | Purchase event, 180 days |
| High-Intent Pages 7d | URL contains /pricing OR /demo, 7 days |

### URL-Based Audiences

Pattern: `URL contains: /segment` with retention window. Name: `RT_[Segment]_[Window]`.

Example: pricing page visitors 14d = `RT_Pricing_14d`, blog readers 30d = `RT_Blog_30d`.

### Event-Based Audiences

**Standard events (by funnel stage):**
PageView > ViewContent > AddToCart > InitiateCheckout > Purchase, Lead, CompleteRegistration.

**Exclusion pattern** (cart abandoners example):

```text
All website visitors who:
  Events: AddToCart
  And also: Did NOT complete: Purchase
  Retention: 14 days
  Name: RT_Cart_NoPurchase_14d
```

## Engagement Audiences

### Video Viewers

| Threshold | Use Case |
|-----------|----------|
| 3s / 10s / ThruPlay (15s+) | Low intent — awareness |
| 25% / 50% viewed | Mid-funnel |
| 75% viewed | High intent |
| 95% viewed | Highest intent |

**Recommended audiences:** 50% viewers 30d (mid-funnel), 75% viewers 60d (high intent), 95% viewers 60d (highest intent).

### Page and Instagram Engagement

Options (same for Facebook Page and Instagram Account):
- Everyone who engaged with your account
- Anyone who visited your profile
- People who engaged with any post or ad
- People who clicked any CTA button (FB only)
- People who sent a message
- People who saved your page/post

**Recommended:** "Engaged with any post or ad" — 60 days.

### Lead Form Engagement

People who opened a lead form but didn't submit — captures high-intent users who considered converting.

## Customer List Setup

### Preparing and Uploading

| Field | Importance |
|-------|-----------|
| Email | Required (primary match key) |
| Phone | Recommended |
| First Name, Last Name | Recommended |
| City, State, Country, Zip | Recommended |

**CSV format:**

```csv
email,phone,fn,ln,ct,st,country,zip
john@example.com,+14155551234,John,Smith,San Francisco,CA,US,94102
```

**Upload:** Create Audience > Customer List > upload CSV > map columns > review match rate. Name: `Customers_All_[Date]`.

### Match Rates

| Data Quality | Expected Match |
|--------------|----------------|
| Email only | 40-60% |
| Email + Phone | 50-70% |
| Email + Phone + Name | 55-75% |
| All fields | 60-80% |

### Customer Segments to Upload

| Segment | Update Frequency |
|---------|------------------|
| All customers | Monthly |
| High-LTV customers | Monthly |
| Recent customers (90d) | Weekly |
| Churned customers | Monthly |
| Leads (not customers) | Weekly |

## Audience Combinations

Use AND/OR logic with include/exclude rules:

```text
Include: [audience A] OR [audience B]
Exclude: [audience C]
```

### Recommended Combinations

**Warm But Not Hot:**
Include All Visitors 30d, exclude Visitors 7d + Purchasers 30d = visited 8-30 days ago, didn't buy.

**Engaged But Not Visited:**
Include Page/IG Engagers 60d, exclude Website Visitors 30d = social engagers who haven't been to site.

**Lapsed Customers:**
Include Purchasers 365d, exclude Purchasers 90d = bought 4-12 months ago, not recently.

## Pixel Event Configuration

**Setup:** Events Manager > Data Sources > Pixel > Settings > Event Setup Tool > navigate to site > configure events.

### Aggregated Event Measurement (AEM) Priority

Rank your 8 events by value (highest to lowest):

1. Purchase
2. InitiateCheckout
3. AddToCart
4. Lead
5. CompleteRegistration
6. ViewContent
7. Search
8. PageView

**Testing:** Events Manager > Pixel > Test Events tab > browse your site > verify events fire.

## Audience Maintenance

| Task | Frequency |
|------|-----------|
| Update customer lists | Weekly-Monthly |
| Check audience sizes | Monthly |
| Remove old audiences | Quarterly |
| Update segment definitions | Quarterly |

### Naming Convention

```text
[Type]_[Specifics]_[Window]

RT_Web_AllVisitors_14d
RT_Web_CartAbandoners_7d
RT_Video_75pct_30d
RT_Engage_PageLikes_60d
LAL_Customers_HighLTV_1pct
```

### Archiving

Add "ARCHIVE" prefix to name and move to Archive folder when no longer used, data too old, or replaced by newer version. Don't delete — may break historical reports.

*Next: [First-Party Data](first-party-data.md)*
