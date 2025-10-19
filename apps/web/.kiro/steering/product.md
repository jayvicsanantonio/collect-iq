# Product Overview

CollectIQ is an AI-powered trading card intelligence platform for Pokémon TCG collectors. It provides real-time market valuation, authenticity verification, and secure portfolio management.

## Core Features

- **Real-Time Valuation**: Multi-source pricing aggregation from eBay, TCGPlayer, and PriceCharting with confidence scoring
- **Authenticity Detection**: AI-driven fake card detection using computer vision, perceptual hashing, and holographic pattern analysis
- **Secure Vault**: User-scoped collection management with JWT authentication
- **Multi-Agent AI**: Specialized agents for ingestion, valuation, authenticity, and feedback orchestrated via AWS Step Functions

## Market Context

- Target market: $400+ billion collectibles market, $14+ billion Pokémon TCG segment
- Problem: Information asymmetry, counterfeit risk, fragmented pricing data
- Competitive edge: Multi-agent orchestration, explainable AI scoring, AWS-native scalability

## User Flow

1. User authenticates via Amazon Cognito (OAuth 2.0 + PKCE)
2. Uploads card image (camera or file) to S3 via presigned URL
3. AI pipeline extracts features (Rekognition), computes valuation and authenticity (Bedrock)
4. Results displayed with confidence scores and human-readable rationale
5. Cards stored in user's vault with time-series pricing data
