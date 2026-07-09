function calculateBankLoanEMI(principal, annualRate, months) {
  if (annualRate === 0) return Math.ceil(principal / months);
  const r = annualRate / 100 / 12;
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(emi);
}

function getBankLoanRecommendation(
  outstandingBalance,
  outstandingInterest,
  annualInterestRate,
  originalPrincipal,
  originalDurationMonths
) {
  if (outstandingBalance <= 0) return { remainingMonths: 0 };
  
  const monthlyRate = annualInterestRate / 100 / 12;
  const interestThisMonth = Math.round(outstandingBalance * monthlyRate);
  
  const emi = calculateBankLoanEMI(originalPrincipal, annualInterestRate, originalDurationMonths);
  
  let remainingMonths = 0;
  if (emi > interestThisMonth) {
    // OLD
    const oldRem = Math.ceil(outstandingBalance / (emi - interestThisMonth));
    
    // NEW
    const ratio = emi / (emi - interestThisMonth);
    const exactN = Math.log(ratio) / Math.log(1 + monthlyRate);
    const newRem = Math.round(exactN);
    
    console.log({
      outstandingBalance,
      interestThisMonth,
      emi,
      oldRem,
      newRem,
      exactN
    });
  }
}

getBankLoanRecommendation(125000, 0, 9, 125000, 12);
