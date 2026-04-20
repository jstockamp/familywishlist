import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
        attributeMapping: {
          email: 'email',
          profilePicture: 'picture',
          fullname: 'name',
        },
      },
      loginWithAmazon: {
        clientId: secret('AMAZON_CLIENT_ID'),
        clientSecret: secret('AMAZON_CLIENT_SECRET'),
        scopes: ['profile', 'postal_code'],
        attributeMapping: {
          email: 'email',
          fullname: 'name',
        },
      },
      callbackUrls: [
        'http://localhost:5173/',
        // Add your Amplify Hosting URL here after first deployment
        // 'https://main.XXXXXXXXXXXX.amplifyapp.com/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        // 'https://main.XXXXXXXXXXXX.amplifyapp.com/',
      ],
    },
  },
  userAttributes: {
    profilePicture: {
      mutable: true,
    },
    fullname: {
      mutable: true,
    },
  },
});
