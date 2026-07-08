const fs = require('fs');
let content = fs.readFileSync('server/storage.ts', 'utf8');

// 1. IStorage interface
const iStorageTarget = `  createRepayment(repayment: Omit<LoanRepayment, "id">): Promise<LoanRepayment>;`;
const iStorageRepl = `  createRepayment(repayment: Omit<LoanRepayment, "id">): Promise<LoanRepayment>;
  recordLoanRepayment(
    repayment: Omit<LoanRepayment, "id">,
    ledger: Omit<schema.LoanLedgerEntry, "id">,
    loanUpdate: Partial<Loan>
  ): Promise<LoanRepayment>;`;
if (!content.includes('recordLoanRepayment(')) {
  content = content.replace(iStorageTarget, iStorageRepl);
}

// 2. MemStorage and DatabaseStorage
let parts = content.split('class DatabaseStorage implements IStorage {');

if (parts.length === 2) {
  // Fix MemStorage
  const memStorageTarget = `  async createRepayment(data: Omit<LoanRepayment, "id">): Promise<LoanRepayment> {`;
  const memStorageRepl = `  async recordLoanRepayment(
    repaymentData: Omit<LoanRepayment, "id">,
    ledgerData: Omit<schema.LoanLedgerEntry, "id">,
    loanUpdate: Partial<Loan>
  ): Promise<LoanRepayment> {
    const rep = await this.createRepayment(repaymentData);
    await this.updateLoan(repaymentData.loanId, loanUpdate);
    return rep;
  }

  async createRepayment(data: Omit<LoanRepayment, "id">): Promise<LoanRepayment> {`;
  if (!parts[0].includes('async recordLoanRepayment(')) {
    parts[0] = parts[0].replace(memStorageTarget, memStorageRepl);
  }

  // Fix DatabaseStorage
  const dbStorageTarget = `  async createRepayment(data: Omit<LoanRepayment, "id">): Promise<LoanRepayment> {`;
  const dbStorageRepl = `  async recordLoanRepayment(
    repaymentData: Omit<LoanRepayment, "id">,
    ledgerData: Omit<schema.LoanLedgerEntry, "id">,
    loanUpdate: Partial<Loan>
  ): Promise<LoanRepayment> {
    const repId = randomUUID();
    const ledgerId = randomUUID();
    
    await this.db.transaction(async (tx) => {
      // Insert repayment
      await tx.insert(schema.loanRepayments).values({ ...repaymentData, id: repId });
      
      // Insert ledger entry
      await tx.insert(schema.loanLedger).values({ ...ledgerData, id: ledgerId });
      
      // Update loan
      await tx.update(schema.loans)
        .set(loanUpdate)
        .where(eq(schema.loans.id, repaymentData.loanId));
    });

    const rows = await this.db.select().from(schema.loanRepayments).where(eq(schema.loanRepayments.id, repId));
    return rows[0] as unknown as LoanRepayment;
  }

  async createRepayment(data: Omit<LoanRepayment, "id">): Promise<LoanRepayment> {`;
  if (!parts[1].includes('async recordLoanRepayment(')) {
    parts[1] = parts[1].replace(dbStorageTarget, dbStorageRepl);
  }
  
  content = parts.join('class DatabaseStorage implements IStorage {');
}

fs.writeFileSync('server/storage.ts', content);
console.log("Patched server/storage.ts successfully.");
