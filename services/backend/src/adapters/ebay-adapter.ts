/**
 * eBay Finding API pricing adapter
 */

import { PriceQuery, RawComp } from '@collectiq/shared';
import { BasePriceAdapter } from './base-price-adapter.js';
import { logger, getSecret } from '../utils/index.js';

interface EbayFindingResponse {
  findCompletedItemsResponse: Array<{
    searchResult: Array<{
      item?: Array<{
        itemId: string[];
        title: string[];
        sellingStatus: Array<{
          currentPrice: Array<{
            __value__: string;
            '@currencyId': string;
          }>;
          sellingState: string[];
        }>;
        listingInfo: Array<{
          endTime: string[];
        }>;
        condition?: Array<{
          conditionDisplayName: string[];
        }>;
        viewItemURL: string[];
      }>;
      '@count': string;
    }>;
    paginationOutput: Array<{
      totalPages: string[];
      pageNumber: string[];
    }>;
  }>;
}

export class EbayAdapter extends BasePriceAdapter {
  name = 'eBay';
  private readonly BASE_URL = 'https://svcs.ebay.com/services/search/FindingService/v1';
  private readonly MAX_PAGES = 3; // Fetch up to 3 pages of results

  constructor() {
    super(20); // 20 requests per minute for eBay
  }

  /**
   * Fetch comparable sales from eBay Finding API
   */
  protected async fetchCompsInternal(query: PriceQuery): Promise<RawComp[]> {
    // Retrieve API key from Secrets Manager (cached internally with TTL)
    const appId = await getSecret('EBAY_APP_ID');

    const allComps: RawComp[] = [];

    // Fetch multiple pages
    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const comps = await this.fetchPage(query, page, appId);
      allComps.push(...comps);

      // Stop if we got fewer results than expected (last page)
      if (comps.length < 100) {
        break;
      }
    }

    logger.info(`eBay adapter fetched ${allComps.length} comps`, { query });
    return allComps;
  }

  /**
   * Fetch a single page of results
   */
  private async fetchPage(
    query: PriceQuery,
    pageNumber: number,
    appId: string,
  ): Promise<RawComp[]> {
    const keywords = this.buildSearchKeywords(query);
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.0.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
      keywords: keywords,
      categoryId: '183454', // Pokémon Trading Card Game category
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true',
      'itemFilter(1).name': 'EndTimeFrom',
      'itemFilter(1).value': this.getStartDate(query.windowDays),
      sortOrder: 'EndTimeSoonest',
      'paginationInput.entriesPerPage': '100',
      'paginationInput.pageNumber': pageNumber.toString(),
    });

    // Add condition filter if specified
    if (query.condition) {
      const ebayCondition = this.mapConditionToEbay(query.condition);
      if (ebayCondition) {
        params.append('itemFilter(2).name', 'Condition');
        params.append('itemFilter(2).value', ebayCondition);
      }
    }

    const url = `${this.BASE_URL}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as EbayFindingResponse;
    return this.parseResponse(data);
  }

  /**
   * Build search keywords from query
   */
  private buildSearchKeywords(query: PriceQuery): string {
    const parts = [query.cardName];

    if (query.set) {
      parts.push(query.set);
    }

    if (query.number) {
      parts.push(query.number);
    }

    return parts.join(' ');
  }

  /**
   * Get ISO date string for windowDays ago
   */
  private getStartDate(windowDays: number): string {
    const date = new Date();
    date.setDate(date.getDate() - windowDays);
    return date.toISOString();
  }

  /**
   * Map standard condition to eBay condition ID
   */
  private mapConditionToEbay(condition: string): string | null {
    const conditionMap: Record<string, string> = {
      Mint: '1000', // ConditionID 1000 - New
      'Near Mint': '2750', // ConditionID 2750 - Like New
      Excellent: '4000', // ConditionID 4000 - Very Good
      Good: '5000', // ConditionID 5000 - Good
      Poor: '6000', // ConditionID 6000 - Acceptable
    };

    return conditionMap[condition] || null;
  }

  /**
   * Parse eBay API response into RawComp array
   */
  private parseResponse(data: EbayFindingResponse): RawComp[] {
    const comps: RawComp[] = [];

    try {
      const searchResult = data.findCompletedItemsResponse?.[0]?.searchResult?.[0];
      const items = searchResult?.item || [];

      for (const item of items) {
        try {
          // Only include sold items
          const sellingState = item.sellingStatus?.[0]?.sellingState?.[0];
          if (sellingState !== 'EndedWithSales') {
            continue;
          }

          const priceData = item.sellingStatus?.[0]?.currentPrice?.[0];
          const price = parseFloat(priceData?.__value__ || '0');
          const currency = priceData?.['@currencyId'] || 'USD';

          const soldDate = item.listingInfo?.[0]?.endTime?.[0] || new Date().toISOString();
          const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown';
          const listingUrl = item.viewItemURL?.[0];

          if (price > 0) {
            comps.push({
              source: 'eBay',
              price,
              currency,
              condition: this.normalizeCondition(condition),
              soldDate,
              listingUrl,
            });
          }
        } catch (error) {
          logger.warn('Failed to parse eBay item', { error });
          continue;
        }
      }
    } catch (error) {
      logger.error('Failed to parse eBay response', error as Error);
    }

    return comps;
  }

  /**
   * Normalize eBay condition names to standard format
   */
  private normalizeCondition(ebayCondition: string): string {
    const normalized = ebayCondition.toLowerCase();

    if (normalized.includes('new') || normalized.includes('mint')) {
      return 'Mint';
    }
    if (normalized.includes('near mint') || normalized.includes('like new')) {
      return 'Near Mint';
    }
    if (normalized.includes('excellent') || normalized.includes('very good')) {
      return 'Excellent';
    }
    if (normalized.includes('good')) {
      return 'Good';
    }
    if (
      normalized.includes('poor') ||
      normalized.includes('acceptable') ||
      normalized.includes('damaged')
    ) {
      return 'Poor';
    }

    return 'Good'; // Default fallback
  }
}
