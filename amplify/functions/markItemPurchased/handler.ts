import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

type HandlerEvent = {
  arguments: {
    itemId: string;
    purchaserName: string;
  };
};

type HandlerResult = {
  success: boolean;
  message: string | null;
};

export const handler = async (event: HandlerEvent): Promise<HandlerResult> => {
  const { itemId, purchaserName } = event.arguments;
  const tableName = process.env.WISHLIST_ITEM_TABLE_NAME;

  if (!tableName) {
    console.error('WISHLIST_ITEM_TABLE_NAME env var not set');
    return { success: false, message: 'Server configuration error' };
  }

  if (!purchaserName?.trim()) {
    return { success: false, message: 'Purchaser name is required' };
  }

  try {
    // First check the item exists and is not already purchased
    const existing = await client.send(
      new GetCommand({ TableName: tableName, Key: { id: itemId } })
    );

    if (!existing.Item) {
      return { success: false, message: 'Item not found' };
    }

    if (existing.Item.isPurchased === true) {
      return {
        success: false,
        message: `This item has already been claimed by ${existing.Item.purchasedByName ?? 'someone'}`,
      };
    }

    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { id: itemId },
        UpdateExpression:
          'SET isPurchased = :purchased, purchasedByName = :name, purchasedAt = :now, updatedAt = :now',
        ConditionExpression: 'attribute_exists(id) AND (isPurchased = :false OR attribute_not_exists(isPurchased))',
        ExpressionAttributeValues: {
          ':purchased': true,
          ':name': purchaserName.trim(),
          ':now': new Date().toISOString(),
          ':false': false,
        },
      })
    );

    return { success: true, message: `Item claimed by ${purchaserName.trim()}` };
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'ConditionalCheckFailedException') {
      return { success: false, message: 'Item was just claimed by someone else' };
    }
    console.error('Error marking item purchased:', error);
    return { success: false, message: 'Failed to claim item, please try again' };
  }
};
