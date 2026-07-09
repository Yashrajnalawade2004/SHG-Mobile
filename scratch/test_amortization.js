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
    const ratio = emi / (emi - interestThisMonth);
    const exactN = Math.log(ratio) / Math.log(1 + monthlyRate);
    remainingMonths = Math.round(exactN);
  }
  return { remainingMonths, emi, interestThisMonth };
}

let balance = 125000;
let rate = 9;
let originalMonths = 12;
let originalPrincipal = 125000;
let month = 0;

console.log("Month", "Balance", "RemainingMonths");

while (balance > 0 && month < 15) {
  const rec = getBankLoanRecommendation(balance, 0, rate, originalPrincipal, originalMonths);
  console.log(month, balance.toFixed(2), rec.remainingMonths);
  
  const payment = Math.min(balance + rec.interestThisMonth, rec.emi);
  balance = balance + rec.interestThisMonth - payment;
  month++;
}
