# CollectIQ vs. TCGScanner — Investor Presentation

---

## Executive Summary

CollectIQ is an AI-powered platform that verifies trading card authenticity, delivers real-time multi-source valuations, and manages collector portfolios. Unlike TCGScanner, CollectIQ provides explainable AI reasoning, faster processing, and cloud-native scalability on AWS.

---

## Market Validation

Apps like **TCGScanner**, **TCGSnap**, and **TCG Card Scanner** confirm strong market demand:

- 100K+ downloads on Google Play
- 4.6–4.8★ average ratings
- Thousands of active collectors globally

CollectIQ is built to capture this demand by offering higher accuracy, better UX, and enterprise-grade reliability.

---

## User Pain & Gaps

Common feedback from users of TCGScanner and similar apps:

- “Too slow to scan and identify — inconsistent on grading.”
- “Scans are inconsistent, even for the same card under same lighting.”
- “Incorrect foiling edition or variant detected.”
- “Unclear pricing sources; frequent subscription paywalls.”
- “Lost data after app updates or sync failures.”

CollectIQ directly addresses these issues using **AWS Rekognition + Bedrock pipelines** for feature extraction and reasoning, paired with **DynamoDB** for persistent data integrity.

---

## Competitive Edge

**CollectIQ differentiates itself through:**

- Multi-agent AI orchestration (Rekognition + Bedrock)
- Real-time pricing fusion from eBay, TCGPlayer, and PriceCharting
- Explainable authenticity scoring (with rationale)
- Secure AWS infrastructure (Cognito, KMS, Step Functions)
- Collector vault with trends, alerts, and analytics

---

## Claim vs. Reality

While competitors claim _99% accuracy_, real-world feedback shows high variance.  
CollectIQ’s transparency and audit logging turn AI reasoning into trust signals — users see not only the result but also _why_ it was made.

---

## Monetization Landscape

- **Competitor pricing:** $5.99–$29.99 subscriptions
- **CollectIQ:** Transparent, usage-based tiers with no hidden fees
- Premium tiers unlock portfolio analytics and authenticity features.

---

## Market Opportunity

The global collectibles market exceeds **$400B**, growing ~13% CAGR.  
Pokémon and Magic: The Gathering continue to drive worldwide engagement.  
CollectIQ sits at the intersection of **AI, trust, and collectibles** — a market ready for disruption.

---

## Vision & Expansion

Next phases:

- AR-based holographic scanning (ARKit/ARCore)
- Blockchain-based authenticity certificates
- Cross-TCG and sports card support
- API partnerships with PSA/CGC grading services

---

## Funding Ask & Use of Proceeds

We seek **$500,000** in funding to scale engineering, AI development, and user acquisition:

- 45% Engineering & AI Research
- 25% Marketing & Partnerships
- 15% Cloud Infrastructure
- 10% Legal & Compliance
- 5% Contingency & Operations

---

## Summary

> TCGScanner shows a price.  
> **CollectIQ shows the truth behind it — authentic, explainable, and reliable.**

By merging AI reasoning, multi-source valuation, and transparent design, CollectIQ transforms how collectors engage with their assets.  
This is not just an app — it’s the future of collectible intelligence.

---

## Feature Comparison

| Feature          | TCGScanner                   | CollectIQ                                         |
| ---------------- | ---------------------------- | ------------------------------------------------- |
| **Accuracy**     | Basic OCR / ~85–90% reliable | Multi-Agent AI with explainable reasoning         |
| **Pricing**      | Single-source static         | Real-time fusion (eBay, TCGPlayer, PriceCharting) |
| **Architecture** | Monolithic mobile app        | AWS Serverless (API Gateway + Step Functions)     |
| **Authenticity** | None / limited checks        | Rekognition + Bedrock authenticity scoring        |
| **User Trust**   | Opaque results               | Transparent rationale + data traceability         |
