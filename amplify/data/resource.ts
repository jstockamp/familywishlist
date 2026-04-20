import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { urlScraperFunction } from '../functions/urlScraper/resource';

const schema = a.schema({
  // Personal item catalog — owned by a user, readable by guests (for wishlist viewing)
  Item: a
    .model({
      title: a.string().required(),
      url: a.string(),
      imageUrl: a.string(),
      price: a.string(),
      notes: a.string(),
      isPurchased: a.boolean().default(false),
      purchasedByName: a.string(),
      purchasedAt: a.datetime(),
      priority: a.enum(['LOW', 'MEDIUM', 'HIGH']),
      retailer: a.string(),
      wishlists: a.hasMany('WishlistItem', 'itemId'),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
    ]),

  // Named wishlist
  Wishlist: a
    .model({
      name: a.string().required(),
      description: a.string(),
      ownerName: a.string(),
      alias: a.string(),
      items: a.hasMany('WishlistItem', 'wishlistId'),
    })
    .secondaryIndexes((index) => [index('alias')])
    .authorization((allow) => [
      allow.owner(),
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
    ]),

  // Junction table: item on a wishlist
  WishlistItem: a
    .model({
      wishlistId: a.id().required(),
      wishlist: a.belongsTo('Wishlist', 'wishlistId'),
      itemId: a.id().required(),
      item: a.belongsTo('Item', 'itemId'),
      sortOrder: a.integer(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
    ]),

  // Scrape metadata from a URL (authenticated users only)
  scrapeUrl: a
    .query()
    .arguments({ url: a.string().required() })
    .returns(
      a.customType({
        title: a.string(),
        imageUrl: a.string(),
        price: a.string(),
        description: a.string(),
      })
    )
    .handler(a.handler.function(urlScraperFunction))
    .authorization((allow) => [allow.authenticated()]),

  // Mark an item as purchased globally (guests and authenticated users)
  markItemPurchased: a
    .mutation()
    .arguments({
      itemId: a.id().required(),
      purchaserName: a.string().required(),
    })
    .returns(
      a.customType({
        success: a.boolean().required(),
        message: a.string(),
      })
    )
    .handler(
      a.handler.custom({
        dataSource: a.ref('Item'),
        entry: './markItemPurchased.js',
      })
    )
    .authorization((allow) => [allow.publicApiKey(), allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
