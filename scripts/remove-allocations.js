const fs = require('fs');

let dc = fs.readFileSync('contexts/DataContext.tsx', 'utf8');
dc = dc.replace(/  bankLoanAllocations: BankLoanAllocation\[\];\n/g, '');
dc = dc.replace(/  allocateBankLoanFunds: \(bankLoanId: string, allocations: \{ memberId: string; allocatedPrincipal: number \}\[\]\) => Promise<void>;\n/g, '');
dc = dc.replace(/  const \[bankLoanAllocations, setBankLoanAllocations\] = useState<BankLoanAllocation\[\]>\(\[\]\);\n/g, '');
dc = dc.replace(/      apiGet<BankLoanAllocation\[\]>\(`\/api\/groups\/\$\{gid\}\/bank-loan-allocations`\),\n/g, '');
dc = dc.replace(/      apiGet<BankLoanAllocation\[\]>\(`\/api\/groups\/\$\{gid\}\/bank-loan-allocations`\)\n/g, '');
dc = dc.replace(/    if \(bla && bla\.status === "fulfilled"\) setBankLoanAllocations\(bla\.value\);\n/g, '');
dc = dc.replace(/  const allocateBankLoanFunds = async \(bankLoanId: string, allocations: any\) => \{\n    await apiPost\(`\/api\/bank-loans\/\$\{bankLoanId\}\/allocations`, \{ allocations \}\);\n    await fetchData\(\);\n  \};\n/g, '');
dc = dc.replace(/  const recordBankLoanRepayment = async \(allocationId: string, data: any\) => \{\n    await apiPost\(`\/api\/bank-loan-allocations\/\$\{allocationId\}\/repayments`, data\);\n    await fetchData\(\);\n  \};\n/g, '');
dc = dc.replace(/  recordBankLoanRepayment: \(allocationId: string, data: any\) => Promise<void>;\n/g, '');
dc = dc.replace(/allocateBankLoanFunds, /g, '');
dc = dc.replace(/recordBankLoanRepayment, /g, '');
dc = dc.replace(/bankLoanAllocations, /g, '');
dc = dc.replace(/, bla\] = res/g, '] = res');

fs.writeFileSync('contexts/DataContext.tsx', dc);

let routes = fs.readFileSync('server/routes.ts', 'utf8');

// The route definitions can be multi-line so we'll just find and remove them.
const startAllocGet = routes.indexOf('"/api/groups/:groupId/bank-loan-allocations"');
if (startAllocGet > -1) {
  const funcStart = routes.lastIndexOf('app.get(', startAllocGet);
  const funcEnd = routes.indexOf('  );', funcStart) + 4;
  if (funcStart > -1 && funcEnd > funcStart) {
    routes = routes.slice(0, funcStart) + routes.slice(funcEnd);
  }
}

const startRepayPost = routes.indexOf('"/api/bank-loan-allocations/:id/repayments"');
if (startRepayPost > -1) {
  const funcStart = routes.lastIndexOf('app.post(', startRepayPost);
  const funcEnd = routes.indexOf('  );', funcStart) + 4;
  if (funcStart > -1 && funcEnd > funcStart) {
    routes = routes.slice(0, funcStart) + routes.slice(funcEnd);
  }
}

// And /api/bank-loans/:id/allocations
const startAllocPost = routes.indexOf('"/api/bank-loans/:id/allocations"');
if (startAllocPost > -1) {
  const funcStart = routes.lastIndexOf('app.post(', startAllocPost);
  const funcEnd = routes.indexOf('  );', funcStart) + 4;
  if (funcStart > -1 && funcEnd > funcStart) {
    routes = routes.slice(0, funcStart) + routes.slice(funcEnd);
  }
}

fs.writeFileSync('server/routes.ts', routes);
console.log('Cleanup complete');
