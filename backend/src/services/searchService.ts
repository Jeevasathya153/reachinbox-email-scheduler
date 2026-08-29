import { esClient, EMAILS_INDEX } from '../config/elasticsearch';
import { EmailRecord } from '../types';

export async function indexEmailInElasticsearch(email: EmailRecord): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: {
        id: email.id,
        userId: email.user_id,
        senderEmail: email.sender_email,
        recipientEmail: email.recipient_email,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduled_at,
        sentAt: email.sent_at,
        createdAt: email.created_at,
      },
    });
    console.log(`[Elasticsearch] Indexed email ${email.id}`);
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to index email ${email.id}:`, err.message);
  }
}

export async function updateEmailStatusInElasticsearch(
  emailId: string,
  status: string,
  sentAt?: Date | null
): Promise<void> {
  try {
    await esClient.update({
      index: EMAILS_INDEX,
      id: emailId,
      doc: {
        status,
        sentAt: sentAt || null,
      },
    });
    console.log(`[Elasticsearch] Updated status for email ${emailId} -> ${status}`);
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to update email ${emailId}:`, err.message);
  }
}

export async function searchEmailsInElasticsearch(userId: string, query: string): Promise<any[]> {
  try {
    const response = await esClient.search({
      index: EMAILS_INDEX,
      body: {
        query: {
          bool: {
            must: [
              { term: { userId } },
              {
                multi_match: {
                  query,
                  fields: ['recipientEmail', 'senderEmail', 'subject', 'body'],
                  fuzziness: 'AUTO',
                },
              },
            ],
          },
        },
      },
    });

    return response.hits.hits.map((hit: any) => hit._source);
  } catch (err: any) {
    console.warn(`[Elasticsearch] Search query failed, falling back to DB:`, err.message);
    return [];
  }
}
