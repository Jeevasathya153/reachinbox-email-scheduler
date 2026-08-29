import { Client } from '@elastic/elasticsearch';
import { config } from './index';

export const esClient = new Client({
  node: config.elasticsearch.url,
  maxRetries: 1,
  requestTimeout: 2000,
});

export const EMAILS_INDEX = 'emails';

export async function initElasticsearch(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAILS_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
    }
  } catch (err: any) {
    // Elasticsearch is optional - silent fallback to MySQL search without throwing or printing warnings
  }
}
