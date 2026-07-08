const fs = require('fs');
let content = fs.readFileSync('server/storage.ts', 'utf8');

// 1. IStorage interface
const iStorageTarget = `  getLoansByGroupId(groupId: string): Promise<Loan[]>;`;
const iStorageRepl = `  getLoansByGroupId(groupId: string): Promise<Loan[]>;
  getLoanLedger(loanId: string): Promise<schema.LoanLedgerEntry[]>;
  getLoanLedgerByGroupId(groupId: string): Promise<schema.LoanLedgerEntry[]>;`;
if (!content.includes('getLoanLedger(loanId: string): Promise<schema.LoanLedgerEntry[]>')) {
  content = content.replace(iStorageTarget, iStorageRepl);
}

// MemStorage is first, DatabaseStorage is second. We can split and replace.
let parts = content.split('class DatabaseStorage implements IStorage {');

if (parts.length === 2) {
  // Fix MemStorage
  const memStorageTarget = `  async getLoansByGroupId(groupId: string): Promise<Loan[]> {`;
  const memStorageRepl = `  async getLoanLedger(loanId: string): Promise<schema.LoanLedgerEntry[]> {
    return [];
  }
  async getLoanLedgerByGroupId(groupId: string): Promise<schema.LoanLedgerEntry[]> {
    return [];
  }
  async getLoansByGroupId(groupId: string): Promise<Loan[]> {`;
  if (!parts[0].includes('async getLoanLedger(loanId: string)')) {
    parts[0] = parts[0].replace(memStorageTarget, memStorageRepl);
  }

  // Fix DatabaseStorage
  const dbStorageTarget = `  async getLoansByGroupId(groupId: string): Promise<Loan[]> {`;
  const dbStorageRepl = `  async getLoanLedger(loanId: string): Promise<schema.LoanLedgerEntry[]> {
    return await this.db.select().from(schema.loanLedger).where(eq(schema.loanLedger.loanId, loanId));
  }
  async getLoanLedgerByGroupId(groupId: string): Promise<schema.LoanLedgerEntry[]> {
    const ledgers = await this.db
      .select({ ledger: schema.loanLedger })
      .from(schema.loanLedger)
      .innerJoin(schema.loans, eq(schema.loanLedger.loanId, schema.loans.id))
      .where(eq(schema.loans.groupId, groupId));
    return ledgers.map(l => l.ledger);
  }
  async getLoansByGroupId(groupId: string): Promise<Loan[]> {`;
  if (!parts[1].includes('async getLoanLedger(loanId: string)')) {
    parts[1] = parts[1].replace(dbStorageTarget, dbStorageRepl);
  }
  
  content = parts.join('class DatabaseStorage implements IStorage {');
}

fs.writeFileSync('server/storage.ts', content);
console.log("Patched server/storage.ts successfully.");
