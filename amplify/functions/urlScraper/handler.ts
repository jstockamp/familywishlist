type HandlerEvent = {
  arguments: { url: string };
};

type ScrapedResult = {
  title: string | null;
  imageUrl: string | null;
  price: string | null;
  description: string | null;
};

function getMetaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function formatPrice(amount: unknown, currency = 'USD'): string | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const num = parseFloat(String(amount).replace(/,/g, ''));
  if (isNaN(num) || num <= 0) return null;
  return currency === 'USD' ? `$${num.toFixed(2).replace(/\.00$/, '')}` : `${currency} ${num}`;
}

/** Strip common retailer suffixes from <title> tag text */
function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[-|:–]\s*(Amazon\.com|Amazon|Target|Walmart\.com|Walmart|LEGO\.com[^<]*|LEGO US|LEGO)(\s*$)/i, '')
    .trim();
}

/**
 * Extract a human-readable product name from common retailer URL slugs.
 * e.g. walmart.com/ip/Funko-Pop-Donald-Trump/12345 → "Funko Pop Donald Trump"
 */
function titleFromUrlSlug(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    let slug: string | null = null;

    if (hostname.includes('walmart.com')) {
      // /ip/Product-Name-Here/12345678
      const m = pathname.match(/\/ip\/([^/]+)\/\d+/);
      if (m) slug = m[1];
    } else if (hostname.includes('target.com')) {
      // /p/product-name-here/-/A-12345678
      const m = pathname.match(/\/p\/([^/]+)\//);
      if (m) slug = m[1];
    } else if (hostname.includes('amazon.com')) {
      // /Product-Name/dp/ASIN  or  /dp/ASIN (no slug)
      const m = pathname.match(/^\/([^/]+)\/dp\//);
      if (m && m[1] !== 'dp') slug = m[1];
    } else if (hostname.includes('lego.com')) {
      // /en-us/product/product-name-12345
      const m = pathname.match(/\/product\/([^/]+)/);
      if (m) slug = m[1];
    }

    if (!slug) return null;

    return slug
      .replace(/-/g, ' ')           // hyphens → spaces
      .replace(/\s+\d+$/, '')       // strip trailing item-ID numbers
      .replace(/\s{2,}/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case
  } catch {
    return null;
  }
}

/** True when the page is a bot-detection challenge rather than the product */
function isBotPage(html: string): boolean {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.toLowerCase() ?? '';
  return (
    title.includes('robot or human') ||
    title.includes('are you a robot') ||
    title.includes('robot check') ||
    title.includes('access denied') ||
    title.includes('just a moment') ||
    title.includes('please verify') ||
    title.includes('sorry! something went wrong') ||
    html.includes('px-captcha') ||
    html.includes('PerimeterX') ||
    html.includes('captcha-container')
  );
}

/** Pull the best image URL from a Walmart product object (works for both API and __NEXT_DATA__ shapes) */
function walmartImageFromProduct(p: Record<string, unknown>): string | null {
  const imgInfo = p?.imageInfo as Record<string, unknown> | undefined;
  const allImages = imgInfo?.allImages as Array<Record<string, unknown>> | undefined;
  return (
    (imgInfo?.thumbnailUrl as string | undefined) ??
    (allImages?.[0]?.url as string | undefined) ??
    (p?.primaryImageUrl as string | undefined) ??
    (p?.primaryImage as string | undefined) ??
    null
  );
}

/**
 * Walmart's internal page-data API returns JSON and sometimes bypasses
 * the PerimeterX challenge that blocks the HTML endpoint.
 * Tries both /ip/{id} and /ip/{slug}/{id} URL forms.
 */
async function fetchWalmartApi(itemId: string, slug: string, headers: Record<string, string>): Promise<ScrapedResult> {
  const result: ScrapedResult = { title: null, imageUrl: null, price: null, description: null };
  const paths = slug
    ? [`%2Fip%2F${encodeURIComponent(slug)}%2F${itemId}`, `%2Fip%2F${itemId}`]
    : [`%2Fip%2F${itemId}`];

  for (const path of paths) {
    try {
      const apiUrl = `https://www.walmart.com/api/2.0/page/fetch?url=${path}&pageType=item`;
      const res = await fetch(apiUrl, {
        headers: { ...headers, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = await res.json() as Record<string, unknown>;

      // The payload structure varies across Walmart API versions
      const product =
        (data?.payload as Record<string, unknown>)?.product?.item ??
        (data?.props as Record<string, unknown>)?.pageProps?.initialData?.data?.product ??
        (data?.props as Record<string, unknown>)?.pageProps?.initialData?.data?.idmlMap?.[itemId];
      if (!product) continue;

      const p = product as Record<string, unknown>;
      const title =
        (p?.product_description as Record<string, unknown>)?.title ??
        (p?.name as string | undefined);
      if (typeof title === 'string') result.title = title;

      const img = walmartImageFromProduct(p);
      if (img) result.imageUrl = img;

      const priceInfo = p?.priceInfo as Record<string, unknown> | undefined;
      const amount =
        (priceInfo?.currentPrice as Record<string, unknown>)?.price ??
        priceInfo?.minPrice;
      const formatted = formatPrice(amount);
      if (formatted) result.price = formatted;

      if (result.title || result.imageUrl) break;
    } catch {
      // try next path
    }
  }
  return result;
}

/** Parse JSON-LD blocks — most reliable for LEGO, Amazon, and some Target/Walmart pages */
function extractJsonLd(html: string): ScrapedResult {
  const result: ScrapedResult = { title: null, imageUrl: null, price: null, description: null };
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const nodes: unknown[] = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const n = node as Record<string, unknown>;
        if (n['@type'] !== 'Product') continue;
        if (!result.title && typeof n['name'] === 'string') result.title = n['name'];
        if (!result.description && typeof n['description'] === 'string') result.description = n['description'];

        if (!result.imageUrl) {
          const img = n['image'];
          if (typeof img === 'string') result.imageUrl = img;
          else if (Array.isArray(img) && typeof img[0] === 'string') result.imageUrl = img[0];
          else if (img && typeof (img as Record<string, unknown>)['url'] === 'string')
            result.imageUrl = (img as Record<string, unknown>)['url'] as string;
        }

        if (!result.price) {
          const offers = n['offers'];
          const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
          for (const offer of offerList) {
            const o = offer as Record<string, unknown>;
            const p = o['price'] ?? o['lowPrice'];
            const currency = typeof o['priceCurrency'] === 'string' ? o['priceCurrency'] : 'USD';
            const formatted = formatPrice(p, currency);
            if (formatted) { result.price = formatted; break; }
          }
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }
  return result;
}

/**
 * Walmart embeds full product data in a <script id="__NEXT_DATA__"> block.
 * Path: props.pageProps.initialData.data.product
 */
function extractWalmartData(html: string): ScrapedResult {
  const result: ScrapedResult = { title: null, imageUrl: null, price: null, description: null };
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return result;
  try {
    const next = JSON.parse(match[1]);
    // Try primary product path
    const product =
      next?.props?.pageProps?.initialData?.data?.product ??
      next?.props?.pageProps?.initialData?.data?.idmlMap?.[Object.keys(next?.props?.pageProps?.initialData?.data?.idmlMap ?? {})[0]];
    if (!product) return result;

    if (typeof product.name === 'string') result.title = product.name;

    // Image: use shared helper that covers all known Walmart product shapes
    const thumbnail = walmartImageFromProduct(product as Record<string, unknown>);
    if (thumbnail) result.imageUrl = thumbnail;

    // Price: currentPrice or priceRange
    const priceInfo = product.priceInfo ?? product.price;
    const amount =
      priceInfo?.currentPrice?.price ??
      priceInfo?.minPrice ??
      priceInfo?.priceRange?.minPrice;
    const formatted = formatPrice(amount);
    if (formatted) result.price = formatted;

    if (typeof product.shortDescription === 'string') result.description = product.shortDescription;
  } catch {
    // parse error — fall through
  }
  return result;
}

/**
 * LEGO.com uses Next.js and embeds full product data in __NEXT_DATA__.
 * Path: props.pageProps.product (or productData.product)
 */
function extractLegoData(html: string): ScrapedResult {
  const result: ScrapedResult = { title: null, imageUrl: null, price: null, description: null };
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return result;
  try {
    const next = JSON.parse(match[1]);
    const pageProps = next?.props?.pageProps ?? {};
    const product =
      pageProps?.product ??
      pageProps?.productData?.product ??
      pageProps?.initialData?.product;
    if (!product) return result;

    if (typeof product.name === 'string') result.title = product.name;

    // Image: primaryImage.url or images[0]
    const img =
      product.primaryImage?.url ??
      product.primaryImage ??
      product.images?.[0]?.url ??
      product.images?.[0];
    if (typeof img === 'string') result.imageUrl = img;

    // Price: price.formattedAmount or price.amount
    const priceObj = product.price ?? product.pricing;
    const rawPrice =
      priceObj?.formattedAmount ??
      priceObj?.amount ??
      priceObj?.salePrice ??
      priceObj?.listPrice;
    if (rawPrice !== undefined && rawPrice !== null) {
      // formattedAmount may already be "$849.99" — use as-is if it starts with $
      if (typeof rawPrice === 'string' && rawPrice.startsWith('$')) {
        result.price = rawPrice;
      } else {
        result.price = formatPrice(rawPrice);
      }
    }
  } catch {
    // fall through
  }
  return result;
}

/**
 * Amazon embeds a JSON map of all product images in data-a-dynamic-image attributes.
 * Keys are image URLs, values are [width, height] arrays — we pick the largest.
 * Falls back to data-old-hires (the hi-res version of the main image).
 */
function extractAmazonData(html: string): ScrapedResult {
  const result: ScrapedResult = { title: null, imageUrl: null, price: null, description: null };

  // data-a-dynamic-image='{"https://...jpg":[900,900],...}' (may be HTML-entity-encoded)
  const dynMatch = html.match(/data-a-dynamic-image=['"](\{[\s\S]*?\})['"]/);
  if (dynMatch) {
    try {
      const decoded = dynMatch[1].replace(/&quot;/g, '"').replace(/&#34;/g, '"');
      const images = JSON.parse(decoded) as Record<string, [number, number]>;
      let bestUrl = '';
      let bestArea = 0;
      for (const [imgUrl, dims] of Object.entries(images)) {
        const area = (dims[0] ?? 0) * (dims[1] ?? 0);
        if (area > bestArea) { bestArea = area; bestUrl = imgUrl; }
      }
      if (bestUrl) result.imageUrl = bestUrl;
    } catch { /* fall through */ }
  }

  // Fallback: data-old-hires on the main landing image
  if (!result.imageUrl) {
    const hiresMatch = html.match(/data-old-hires=["']([^"']+)["']/);
    if (hiresMatch?.[1]) result.imageUrl = hiresMatch[1];
  }

  // Fallback: src of #landingImage
  if (!result.imageUrl) {
    const landingMatch = html.match(/<img[^>]+id=["']landingImage["'][^>]+src=["']([^"']+)["']/i)
      ?? html.match(/<img[^>]+src=["']([^"']+)["'][^>]+id=["']landingImage["']/i);
    if (landingMatch?.[1] && !landingMatch[1].includes('gif')) result.imageUrl = landingMatch[1];
  }

  return result;
}

/**
 * Target embeds product data in window.__PRELOADED_STATE__ or a __TGT_DATA__ script.
 */
function extractTargetData(html: string): ScrapedResult {
  const result: ScrapedResult = { title: null, imageUrl: null, price: null, description: null };

  // Strategy 1: __PRELOADED_STATE__ JSON blob — walk several known path variations
  const preloaded = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/);
  if (preloaded) {
    try {
      const state = JSON.parse(preloaded[1]);
      const pdp =
        state?.product?.productDetails?.item ??
        state?.pdp?.product?.item ??
        state?.pdpV2?.productItem ??
        state?.product?.item;
      if (pdp) {
        const desc = pdp?.product_description?.title ?? pdp?.general_description ?? pdp?.title;
        if (typeof desc === 'string') result.title = desc;
        const img = pdp?.enrichment?.images?.primary_image_url ?? pdp?.enrichment?.images?.[0];
        if (typeof img === 'string') result.imageUrl = img;
        // Price paths vary by Target version
        const priceObj = pdp?.price ?? pdp?.priceInfo;
        const rawPrice =
          priceObj?.current_retail ??
          priceObj?.formatted_current_price ??
          priceObj?.formatted_current_price_type ??
          priceObj?.currentRetail;
        if (rawPrice !== undefined && rawPrice !== null) result.price = formatPrice(rawPrice);
      }
    } catch {
      // fall through
    }
  }

  // Strategy 2: __TGT_DATA__ script variable
  if (!result.title) {
    const tgtData = html.match(/window\.__TGT_DATA__\s*=\s*(\{[\s\S]*?\});\s*(?:window|<\/script>)/);
    if (tgtData) {
      try {
        const data = JSON.parse(tgtData[1]);
        const item = data?.pdp?.product?.item ?? data?.product?.item;
        if (item?.product_description?.title) result.title = item.product_description.title;
        const img = item?.enrichment?.images?.primary_image_url;
        if (typeof img === 'string') result.imageUrl = img;
        const rawPrice = item?.price?.current_retail ?? item?.price?.formatted_current_price;
        if (rawPrice !== undefined && rawPrice !== null) result.price = formatPrice(rawPrice);
      } catch {
        // fall through
      }
    }
  }

  // Strategy 3: HTML element with data-test="product-price" (present in SSR output)
  if (!result.price) {
    const priceEl = html.match(/data-test=["']product-price["'][^>]*>\s*\$?([\d,.]+)/i);
    if (priceEl?.[1]) result.price = formatPrice(priceEl[1].replace(/,/g, ''));
  }

  return result;
}

/**
 * Target's RedSky pricing API — uses the TCIN (item ID) from the URL.
 * The API key is Target's public web key, embedded in their web bundle.
 */
async function fetchTargetPricing(tcin: string): Promise<string | null> {
  try {
    const apiUrl =
      `https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1` +
      `?key=9f36aeafbe60771e321a7cc95a78140772ab3e96&tcin=${tcin}&pricing_store_id=3991`;
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/json', 'Origin': 'https://www.target.com' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    // Path: data.data.product.price.current_retail or formatted_current_price
    const price =
      (data?.data as Record<string, unknown>)?.product?.price?.current_retail ??
      (data?.data as Record<string, unknown>)?.product?.price?.formatted_current_price;
    return formatPrice(price);
  } catch {
    return null;
  }
}

export const handler = async (event: HandlerEvent): Promise<ScrapedResult> => {
  const { url } = event.arguments;

  try {
    const browserHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Upgrade-Insecure-Requests': '1',
    };

    const response = await fetch(url, {
      redirect: 'follow',
      headers: browserHeaders,
      signal: AbortSignal.timeout(12000),
    });

    // Use the final URL after redirects (handles shorteners like a.co → amazon.com)
    const finalUrl = response.url || url;
    const hostname = new URL(finalUrl).hostname.toLowerCase();

    const html = await response.text();
    const botBlocked = isBotPage(html);

    // --- Site-specific extractors (highest priority) ---
    let siteSpecific: ScrapedResult = { title: null, imageUrl: null, price: null, description: null };
    if (hostname.includes('lego.com')) {
      if (!botBlocked) siteSpecific = extractLegoData(html);
      if (botBlocked && !siteSpecific.title) {
        return { title: titleFromUrlSlug(url), imageUrl: null, price: null, description: null };
      }
    } else if (hostname.includes('walmart.com')) {
      if (!botBlocked) siteSpecific = extractWalmartData(html);
      // Try JSON API whether or not we got bot-blocked on the HTML endpoint
      if (!siteSpecific.title || !siteSpecific.imageUrl) {
        const itemIdMatch = finalUrl.match(/\/ip\/([^/?]+)\/(\d+)|\/ip\/(\d+)/);
        const itemId = itemIdMatch?.[2] ?? itemIdMatch?.[3];
        const slug = itemIdMatch?.[2] ? (itemIdMatch[1] ?? '') : '';
        if (itemId) {
          const apiResult = await fetchWalmartApi(itemId, slug, browserHeaders);
          // Merge: prefer API result for any missing fields
          if (!siteSpecific.title && apiResult.title) siteSpecific.title = apiResult.title;
          if (!siteSpecific.imageUrl && apiResult.imageUrl) siteSpecific.imageUrl = apiResult.imageUrl;
          if (!siteSpecific.price && apiResult.price) siteSpecific.price = apiResult.price;
        }
      }
      // Last-resort: scan HTML for Walmart CDN image URLs
      if (!siteSpecific.imageUrl && !botBlocked) {
        const cdnMatch = html.match(/https:\/\/i5\.walmartimages\.com\/[^"'\s,)]+\.(?:jpg|jpeg|png|webp)/i);
        if (cdnMatch) siteSpecific.imageUrl = cdnMatch[0];
      }
      // If both attempts failed, return just the URL-slug title rather than bot-page content
      if (botBlocked && !siteSpecific.title) {
        return { title: titleFromUrlSlug(finalUrl), imageUrl: null, price: null, description: null };
      }
    } else if (hostname.includes('amazon.com')) {
      if (!botBlocked) siteSpecific = extractAmazonData(html);
      if (botBlocked && !siteSpecific.imageUrl) {
        siteSpecific.imageUrl = null;
      }
    } else if (hostname.includes('target.com')) {
      if (!botBlocked) siteSpecific = extractTargetData(html);
      if (botBlocked && !siteSpecific.title) {
        return { title: titleFromUrlSlug(url), imageUrl: null, price: null, description: null };
      }
      // If we have title/image but no price, try the RedSky pricing API
      if (!siteSpecific.price) {
        const tcinMatch = url.match(/\/A-(\d+)/);
        if (tcinMatch) {
          siteSpecific.price = await fetchTargetPricing(tcinMatch[1]);
        }
      }
    } else if (botBlocked) {
      // Any other site that served a bot-detection page — use slug if available
      return { title: titleFromUrlSlug(url), imageUrl: null, price: null, description: null };
    }

    // --- JSON-LD (works well for LEGO, Amazon, sometimes Target/Walmart) ---
    const jsonLd = extractJsonLd(html);

    // --- OpenGraph / Twitter card ---
    const ogTitle = getMetaContent(html, 'og:title') || getMetaContent(html, 'twitter:title');
    const ogImage = getMetaContent(html, 'og:image') || getMetaContent(html, 'twitter:image');
    const ogDesc =
      getMetaContent(html, 'og:description') ||
      getMetaContent(html, 'description') ||
      getMetaContent(html, 'twitter:description');

    // --- Product price meta tags (Target and others use these) ---
    let metaPrice: string | null = null;
    const priceAmount =
      getMetaContent(html, 'product:price:amount') || getMetaContent(html, 'og:price:amount');
    if (priceAmount) {
      const currency =
        getMetaContent(html, 'product:price:currency') ||
        getMetaContent(html, 'og:price:currency') ||
        'USD';
      metaPrice = formatPrice(priceAmount, currency);
    }

    // --- Amazon HTML fallbacks ---
    let amazonTitle: string | null = null;
    const titleSpan = html.match(/<span[^>]+id=["']productTitle["'][^>]*>\s*([\s\S]*?)\s*<\/span>/i);
    if (titleSpan?.[1]) amazonTitle = titleSpan[1].replace(/<[^>]+>/g, '').trim();

    let amazonPrice: string | null = null;
    const amazonPricePatterns = [
      /"priceAmount"\s*:\s*"?([\d.]+)"?/,
      /<span class="a-offscreen">\$?([\d,.]+)<\/span>/,
      /id="corePriceDisplay[^"]*"[\s\S]{0,500}?<span[^>]*class="[^"]*a-price-whole[^"]*"[^>]*>([\d,]+)/,
      /id="priceblock_ourprice"[^>]*>\s*\$?([\d,.]+)/,
      /id="kindle-price"[^>]*>\s*\$?([\d,.]+)/,
    ];
    for (const pattern of amazonPricePatterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const formatted = formatPrice(match[1].replace(/,/g, ''));
        if (formatted) { amazonPrice = formatted; break; }
      }
    }

    // --- <title> tag (last resort for title) ---
    let htmlTitle: string | null = null;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) htmlTitle = cleanTitle(titleMatch[1].trim());

    // --- Merge: site-specific > JSON-LD > OG > HTML fallbacks > URL slug ---
    const slugTitle = titleFromUrlSlug(finalUrl);
    const title = siteSpecific.title || jsonLd.title || amazonTitle || ogTitle || htmlTitle || slugTitle;
    const imageUrl = siteSpecific.imageUrl || jsonLd.imageUrl || ogImage;
    const price = siteSpecific.price || jsonLd.price || metaPrice || amazonPrice;
    const description = siteSpecific.description || jsonLd.description || ogDesc;

    return {
      title: title ? decodeHtmlEntities(title).substring(0, 200) : null,
      imageUrl: imageUrl || null,
      price: price || null,
      description: description ? decodeHtmlEntities(description).substring(0, 500) : null,
    };
  } catch (error) {
    console.error('Error scraping URL:', error);
    return { title: titleFromUrlSlug(url), imageUrl: null, price: null, description: null };
  }
};
