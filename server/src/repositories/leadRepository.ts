import { readStore, updateStore } from '../db';

export interface LeadRecord {
  id: string;
  ownerUserId: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: string;
  leadScore: number;
  createdAt: string;
  updatedAt: string;
}

export function createLead(input: {
  id: string;
  ownerUserId: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  status: string;
}) {
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;
  const leadScore = 1;
  updateStore((store) => {
    store.leads.push({
      id: input.id,
      ownerUserId: input.ownerUserId,
      name: input.name,
      phone: input.phone,
      email: input.email,
      company: input.company,
      status: input.status,
      leadScore,
      createdAt,
      updatedAt,
    });
  });
  return {
    ...input,
    leadScore,
    createdAt,
    updatedAt,
  };
}

export function findLeadById(id: string): LeadRecord | null {
  const store = readStore();
  const row = store.leads.find((item) => item.id === id);
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    status: row.status,
    leadScore: row.leadScore,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listLeadsByOwner(ownerUserId: string) {
  const store = readStore();
  return store.leads
    .filter((row) => row.ownerUserId === ownerUserId)
    .map((row) => ({
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      phone: row.phone,
      email: row.email,
      company: row.company,
      status: row.status,
      leadScore: row.leadScore,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
}

export function updateLeadScore(id: string, score: number) {
  const updatedAt = new Date().toISOString();
  updateStore((store) => {
    const lead = store.leads.find((item) => item.id === id);
    if (lead) {
      lead.leadScore = score;
      lead.updatedAt = updatedAt;
    }
  });
  return updatedAt;
}

