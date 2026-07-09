import re

file_path = "contexts/LanguageContext.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

missing_keys = """
  "reports.group_reports": { "en": "SHG Reports", "mr": "गट अहवाल" },
  "reports.time_range": { "en": "Time Range", "mr": "वेळ मर्यादा" },
  "reports.cash_book_desc": { "en": "Running physical cash balance tracking all SHG cash movements.", "mr": "गटाच्या सर्व रोख व्यवहारांचा मागोवा ठेवणारी भौतिक रोख शिल्लक." },
  "reports.bank_book_desc": { "en": "Running bank balance tracking all online/cheque movements.", "mr": "सर्व ऑनलाइन/चेक व्यवहारांचा मागोवा ठेवणारी बँक शिल्लक." },
  "reports.financial_desc": { "en": "Overall financial position (Income, Expenses, Assets, Liabilities).", "mr": "एकूण आर्थिक स्थिती (उत्पन्न, खर्च, मालमत्ता, दायित्वे)." },
  "reports.savings_desc": { "en": "Detailed list of member savings contributions and late fees.", "mr": "सदस्यांच्या बचत योगदानाची आणि विलंब शुल्काची सविस्तर यादी." },
  "reports.internal_loan_desc": { "en": "Record of all internal SHG loans, outstanding amounts, and recovery %.", "mr": "सर्व अंतर्गत गट कर्जे, थकबाकी आणि वसुली % यांची नोंद." },
  "reports.bank_loan_desc": { "en": "Record of external bank loans and member allocations.", "mr": "बाह्य बँक कर्जे आणि सदस्य वाटपांची नोंद." },
  "reports.recovery_desc": { "en": "Monthly monitoring of both internal and bank loan recoveries.", "mr": "अंतर्गत आणि बँक कर्ज वसुलीवर मासिक देखरेख." },
  "reports.member_passbook_desc": { "en": "Individual member's combined savings and loan passbooks.", "mr": "वैयक्तिक सदस्याचे एकत्रित बचत आणि कर्ज पासबुक." },
  "reports.member_register_desc": { "en": "Master roster of all active and former members.", "mr": "सर्व सक्रिय आणि माजी सदस्यांची मुख्य यादी." },
  "reports.meeting_register_desc": { "en": "Log of all scheduled and completed SHG meetings.", "mr": "सर्व नियोजित आणि पूर्ण झालेल्या गट बैठकांची नोंद." },
  "reports.annual_desc": { "en": "Comprehensive year-end statistical report for auditing.", "mr": "ऑडिटिंगसाठी सर्वसमावेशक वर्षाअखेरचा सांख्यिकीय अहवाल." },
  "reports.select_year": { "en": "Year", "mr": "वर्ष" },
  "reports.select_month": { "en": "Month", "mr": "महिना" },
  "reports.select_quarter": { "en": "Quarter", "mr": "तिमाही" },
  "reports.select_half": { "en": "Half", "mr": "सहामाही" },
  "reports.payment_method": { "en": "Payment Method", "mr": "पेमेंट पद्धत" },
  "reports.loan_status": { "en": "Loan Status", "mr": "कर्जाची स्थिती" },
  "reports.select_member": { "en": "Select Member", "mr": "सदस्य निवडा" },
  "reports.monthly": { "en": "Monthly", "mr": "मासिक" },
  "reports.quarterly": { "en": "Quarterly", "mr": "तिमाही" },
  "reports.half_yearly": { "en": "Half-Yearly", "mr": "सहामाही" },
  "reports.annual": { "en": "Annual", "mr": "वार्षिक" },
  "reports.custom": { "en": "Custom", "mr": "सानुकूल" },
  "reports.from_date": { "en": "From Date", "mr": "या तारखेपासून" },
  "reports.to_date": { "en": "To Date", "mr": "या तारखेपर्यंत" },
  "reports.generate_report": { "en": "Generate Report", "mr": "अहवाल तयार करा" },
"""

insert_pos = content.find("export const translations: Record<string, any> = {")
if insert_pos != -1:
    brace_pos = content.find("{", insert_pos)
    new_content = content[:brace_pos + 1] + "\n" + missing_keys + content[brace_pos + 1:]
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Injected translation keys successfully.")
else:
    print("Could not find translations object.")
