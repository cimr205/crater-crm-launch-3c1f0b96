import { randomUUID } from 'crypto';
import { updateStore } from '../../db';

export function logMetaAutomation(
  companyId: string,
  action: string,
  status: 'ok' | 'error',
  message: string
) {
  updateStore((store) => {
    store.metaAutomationLogs.push({
      id: randomUUID(),
      companyId,
      action,
      status,
      message,
      createdAt: new Date().toISOString(),
    });
  });
}

