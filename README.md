# Wishlist

A serverless family wishlist app built with AWS Amplify Gen 2, React, and TypeScript. Users build a personal item catalog and add items to one or more wishlists. Wishlists are shareable via link — anyone with the link can view the list and claim items as gifts, without revealing who claimed what to the list owner.

## Features

- **Personal item catalog** — add items once, put them on multiple wishlists
- **URL scraper** — paste a product URL from Amazon, Target, Walmart, or LEGO and auto-fill the title, image, and price
- **Shareable wishlists** — public link requires no login to view or claim items
- **Claim privacy** — guests see "Already claimed" with no name; the owner can optionally reveal claim details with a toggle
- **Grid and list views** — sortable list view with columns for price, priority, and status
- **Federated login** — sign in with Google or Login with Amazon, or use email/password

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | AWS Amplify Gen 2 |
| API | AWS AppSync (GraphQL) |
| Database | Amazon DynamoDB |
| Auth | Amazon Cognito (Google + Amazon federated login) |
| Functions | AWS Lambda (Node.js) — URL scraper, item claiming |
| Hosting | AWS Amplify Hosting + CloudFront |

## Data Model

```
User
 └── Items (personal catalog)
      └── WishlistItems (junction)
           └── Wishlists
```

- **Item** — owned by a user; holds all product details including claim state
- **Wishlist** — owned by a user; publicly readable via link
- **WishlistItem** — junction table linking an Item to a Wishlist; removing an item from a wishlist does not delete it from the catalog
- Claiming an item is **global** — if an item appears on two wishlists, claiming it on one marks it everywhere

## Prerequisites

- Node.js 18+
- AWS CLI configured with a profile that has sufficient permissions
- AWS Amplify CLI: `npm install -g @aws-amplify/backend-cli`
- Google OAuth app credentials (for Google sign-in)
- Login with Amazon app credentials (for Amazon sign-in)

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Store OAuth secrets

```bash
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
npx ampx sandbox secret set AMAZON_CLIENT_ID
npx ampx sandbox secret set AMAZON_CLIENT_SECRET
```

### 3. Start the sandbox backend

This provisions a personal cloud backend (AppSync, DynamoDB, Cognito, Lambda) and watches for changes:

```bash
npm run sandbox
```

The sandbox script uses the `wishlist-website-claude` AWS profile and `us-west-2` region. Update `package.json` if your profile or region differs.

### 4. Start the frontend

In a separate terminal:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 5. Configure OAuth redirect URLs

In your **Google Cloud Console** and **Login with Amazon** developer console, add `http://localhost:5173/` as an allowed redirect/callback URL.

## Project Structure

```
amplify/
  auth/resource.ts          # Cognito config (email + Google + Amazon)
  data/resource.ts          # GraphQL schema (Item, Wishlist, WishlistItem)
  data/markItemPurchased.js # AppSync JS resolver — DynamoDB UpdateItem
  functions/
    urlScraper/
      handler.ts            # Lambda: scrapes product details from retailer URLs
      resource.ts           # Function definition
  backend.ts                # Root backend composition

src/
  components/
    AddItemModal.tsx         # Add/edit item; "from catalog" or "new item" tabs
    ItemCard.tsx             # Grid and list card; claim + remove + edit actions
    Layout.tsx               # Nav header with My Wishlists / My Items links
    WishlistCard.tsx         # Dashboard wishlist card with share + delete
    CreateWishlistModal.tsx  # New wishlist form
    ProtectedRoute.tsx       # Auth guard
  pages/
    DashboardPage.tsx        # My Wishlists
    ItemsPage.tsx            # My Items catalog
    WishlistPage.tsx         # Public/owner wishlist view
    LoginPage.tsx            # Sign-in page
  App.tsx                    # Routes
  main.tsx                   # Amplify.configure + React root
```

## Deploying to Production

### 1. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/wishlist.git
git push -u origin main
```

### 2. Connect to Amplify Hosting

1. Open the [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. **Create new app** → **Host web app** → connect your GitHub repo
3. Amplify detects Gen 2 automatically — accept the defaults and deploy

### 3. Add production secrets

In the Amplify Console under your app → **Secrets**, add the same four OAuth keys set in step 2 of local setup.

### 4. Add a custom domain

1. Amplify Console → your app → **Hosting** → **Custom domains** → **Add domain**
2. Enter your root domain and configure the subdomain (e.g. `wishlist` → `main` branch)
3. Add the generated CNAME record to your DNS provider, or approve auto-configuration if using Route 53

### 5. Update OAuth callback URLs

Add your production URL (e.g. `https://wishlist.stockamp.net`) to:
- `amplify/auth/resource.ts` — `callbackUrls` and `logoutUrls` arrays
- Google Cloud Console — authorized redirect URIs
- Login with Amazon developer console — allowed return URLs

Then push the change and let Amplify redeploy.

## URL Scraper Notes

The scraper Lambda runs in an AWS datacenter. Some retailers actively block requests from known cloud IP ranges:

| Retailer | Status |
|---|---|
| Amazon | Works reliably (JSON-LD + HTML fallbacks) |
| Target | Title and image usually work; price varies |
| LEGO | Blocked by Cloudflare; title extracted from URL slug |
| Walmart | Blocked by PerimeterX; title extracted from URL slug |

When a retailer blocks the scrape, the item name is pre-filled from the URL slug (e.g. `millennium-falcon-75192` → "Millennium Falcon 75192") and price/image can be filled in manually.

## License

Private — all rights reserved.
