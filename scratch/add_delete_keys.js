const fs = require('fs');
const path = require('path');

const langPath = path.join(__dirname, '../contexts/LanguageContext.tsx');
let content = fs.readFileSync(langPath, 'utf8');

const additionsEn = `
    "bank_loan.delete_title": "Delete Bank Loan",
    "bank_loan.delete_message": "Are you sure you want to delete this bank loan? All allocations and repayments associated with it will also be permanently deleted.",
`;

const additionsMr = `
    "bank_loan.delete_title": "बँक कर्ज हटवा",
    "bank_loan.delete_message": "तुम्हाला खात्री आहे की तुम्हाला हे बँक कर्ज हटवायचे आहे? याशी संबंधित सर्व वाटप आणि परतफेडी देखील कायमस्वरूपी हटवल्या जातील.",
`;

    // Inject right after // Group Bank Loan Module
    content = content.replace('// Group Bank Loan Module', '// Group Bank Loan Module\\n    "bank_loan.delete": "Delete",' + additionsEn);
    
    // For Marathi, it might not have the comment, but we can look for "bank_loan.title": "गट बँक कर्ज"
    content = content.replace('"bank_loan.title": "गट बँक कर्ज",', '"bank_loan.title": "गट बँक कर्ज",\\n    "bank_loan.delete": "हटवा",' + additionsMr);
    
    fs.writeFileSync(langPath, content);
    console.log('Keys injected successfully');
