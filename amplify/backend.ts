import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { urlScraperFunction } from './functions/urlScraper/resource';

defineBackend({
  auth,
  data,
  urlScraperFunction,
});
