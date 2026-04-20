import { util } from '@aws-appsync/utils';

/**
 * AppSync JS resolver — updates the Item table directly.
 * Claiming is global: one claim marks the item on every wishlist it appears on.
 */
export function request(ctx) {
  const { itemId, purchaserName } = ctx.args;
  const now = util.time.nowISO8601();

  return {
    operation: 'UpdateItem',
    key: util.dynamodb.toMapValues({ id: itemId }),
    update: {
      expression:
        'SET isPurchased = :t, purchasedByName = :name, purchasedAt = :now, updatedAt = :now',
      expressionValues: util.dynamodb.toMapValues({
        ':t': true,
        ':name': purchaserName,
        ':now': now,
      }),
    },
    condition: {
      expression:
        'attribute_exists(id) AND (isPurchased = :f OR attribute_not_exists(isPurchased))',
      expressionValues: util.dynamodb.toMapValues({ ':f': false }),
    },
  };
}

export function response(ctx) {
  if (ctx.error) {
    if (ctx.error.type === 'DynamoDB:ConditionalCheckFailedException') {
      return { success: false, message: 'This item has already been claimed' };
    }
    util.error(ctx.error.message, ctx.error.type);
  }
  return { success: true, message: `Item claimed by ${ctx.args.purchaserName}` };
}
