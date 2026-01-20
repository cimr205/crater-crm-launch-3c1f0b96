import { randomUUID } from 'crypto';
import { readStore, updateStore } from '../db';
import type { StoreCompany, StoreData } from '../db';

export function createCompany(input: { name: string; ownerUserId?: string; userLimit?: number }) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  updateStore((store: StoreData) => {
    store.companies.push({
      id,
      name: input.name,
      ownerUserId: input.ownerUserId,
      userLimit: input.userLimit,
      createdAt,
    });
  });
  return { id, name: input.name, ownerUserId: input.ownerUserId, userLimit: input.userLimit, createdAt };
}

export function listCompanies() {
  const store: StoreData = readStore();
  return store.companies;
}

export function findCompanyById(id: string): StoreCompany | null {
  const store: StoreData = readStore();
  return store.companies.find((item) => item.id === id) || null;
}

export function listCompaniesWithCounts() {
  const store: StoreData = readStore();
  return store.companies.map((company) => {
    const userCount = store.users.filter((user) => user.companyId === company.id).length;
    return { ...company, userCount };
  });
}

