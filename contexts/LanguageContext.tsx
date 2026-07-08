import { createContext, useContext, useState, useMemo, ReactNode, useCallback, useEffect } from "react";
import { getItem, setItem, getItemSync } from "@/lib/storage";
import { apiPatch, getToken } from "@/lib/api";

export type Language = "en" | "mr";

export const translations: Record<string, any> = {



  "qr_modal_title": { "en": "Pay via QR", "mr": "QR द्वारे भरा" },
  "qr_disclaimer": { "en": "After making the payment, please inform the President or Treasurer. Your repayment will be recorded only after they verify the payment.", "mr": "पेमेंट केल्यानंतर, कृपया अध्यक्ष किंवा खजिनदाराला कळवा. पेमेंटची खात्री झाल्यानंतरच तुमची परतफेड नोंदवली जाईल." },
  "qr_not_configured": { "en": "The SHG has not yet configured a payment QR code. Please contact the President.", "mr": "बचत गटाने अद्याप पेमेंट QR कोड सेट केलेला नाही. कृपया अध्यक्षांशी संपर्क साधा." },
  "outstanding_interest_due": { "en": "Outstanding Interest", "mr": "थकबाकी व्याज" },
  "total_payable_this_month": { "en": "Total Payable This Month", "mr": "या महिन्याची एकूण देय रक्कम" },
  "recommended_monthly_payment": { "en": "Recommended Monthly Payment", "mr": "शिफारस केलेला मासिक हप्ता" },
  "monthly_installment": { "en": "Monthly Installment", "mr": "मासिक हप्ता" },

  "bankLoans": { "en": "Bank Loans", "mr": "बँक कर्ज" },
  "createBankLoan": { "en": "Create Bank Loan", "mr": "बँक कर्ज तयार करा" },
  "bankName": { "en": "Bank Name", "mr": "बँकेचे नाव" },
  "branch": { "en": "Branch", "mr": "शाखा" },
  "accountNumber": { "en": "Account Number", "mr": "खाते क्रमांक" },
  "sanctionDate": { "en": "Sanction Date", "mr": "मंजुरीची तारीख" },
  "sanctionAmount": { "en": "Sanction Amount", "mr": "मंजूर रक्कम" },
  "annualInterestRate": { "en": "Annual Interest Rate (%)", "mr": "वार्षिक व्याजदर (%)" },
  "durationMonths": { "en": "Duration (Months)", "mr": "कालावधी (महिने)" },
  "allocateFunds": { "en": "Allocate Funds", "mr": "निधी वाटप करा" },
  "bankLoanDetails": { "en": "Bank Loan Details", "mr": "बँक कर्ज तपशील" },
  "allocatedAmount": { "en": "Allocated Amount", "mr": "वाटप केलेली रक्कम" },
  "bankOutstanding": { "en": "Bank Outstanding", "mr": "बँक थकीत रक्कम" },
  "bankRepayment": { "en": "Bank Repayment", "mr": "बँक परतफेड" },
  "totalAllocated": { "en": "Total Allocated", "mr": "एकूण वाटप" },
  "availableToAllocate": { "en": "Available to Allocate", "mr": "वाटपासाठी उपलब्ध" },
  "ledger_loan_disbursed": { "en": "Loan Disbursed", "mr": "कर्ज वितरित" },
  "ledger_repayment": { "en": "Repayment", "mr": "परतफेड" },
  "ledger_paid": { "en": "Paid", "mr": "भरलेले" },
  "ledger_principal": { "en": "Principal", "mr": "मुद्दल" },
  "ledger_interest": { "en": "Interest", "mr": "व्याज" },
  "ledger_balance": { "en": "Balance", "mr": "शिल्लक" },
  "ledger_receipt_no": { "en": "Receipt No", "mr": "पावती क्र." },
  "ledger_opening_balance": { "en": "Opening Balance", "mr": "सुरुवातीची शिल्लक" },
  "ledger_closing_balance": { "en": "Closing Balance", "mr": "अंतिम शिल्लक" },
  "ledger_installment": { "en": "Installment", "mr": "हप्ता" },
  "reducing_balance": { "en": "Reducing Balance", "mr": "कमी होणारी शिल्लक" },
  "dashboard_total_loans_disbursed": { "en": "Total Loans Disbursed", "mr": "एकूण वितरित कर्ज" },
  "dashboard_principal_recovered": { "en": "Principal Recovered", "mr": "वसूल झालेले मुद्दल" },
  "dashboard_interest_collected": { "en": "Interest Collected", "mr": "जमा झालेले व्याज" },
  "total_outstanding": { "en": "Total Outstanding", "mr": "एकूण थकबाकी" },
  "dashboard_completed_loans": { "en": "Completed Loans", "mr": "पूर्ण झालेली कर्जे" },
  "principal_portion": { "en": "Principal Portion", "mr": "मुद्दलाचा भाग" },
  "interest_portion": { "en": "Interest Portion", "mr": "व्याजाचा भाग" },
  "last_payment_date": { "en": "Last Payment Date", "mr": "शेवटच्या भरण्याची तारीख" },
  "last_payment_amount": { "en": "Last Payment Amount", "mr": "शेवटच्या भरण्याची रक्कम" },
  "next_recommended_payment": { "en": "Next Recommended Payment", "mr": "पुढील शिफारस केलेला भरणा" },
  "loan_status": { "en": "Loan Status", "mr": "कर्जाची स्थिती" },
  "receipt_number": { "en": "Receipt Number", "mr": "पावती क्रमांक" },
  "qr_payment_warning": { "en": "Note: Payment via QR does not automatically update your loan balance. The President or Treasurer must verify and record the repayment.", "mr": "टीप: QR द्वारे भरणा केल्याने कर्जाची शिल्लक आपोआप अपडेट होत नाही. अध्यक्ष किंवा खजिनदारांनी या भरण्याची पडताळणी करून नोंद करणे आवश्यक आहे." },
  "export_passbook": { "en": "Export Passbook", "mr": "पासबुक डाउनलोड करा" },
  "passbook": { "en": "Passbook", "mr": "पासबुक" },
  "loan_summary": { "en": "Loan Summary", "mr": "कर्जाचा सारांश" },
  "current_month_summary": { "en": "Current Month Summary", "mr": "चालू महिन्याचा सारांश" },
  "pay_via_qr": { "en": "Pay via QR", "mr": "QR द्वारे भरा" },
  "total_amount_to_pay": { "en": "Total Amount to Pay", "mr": "भरण्याची एकूण रक्कम" },

  "common": {
    "pdf_status_completed": { "en": "Completed", "mr": "पूर्ण झाले" },
    "pdf_status_active": { "en": "Active", "mr": "सक्रिय" },
    "pdf_status_confirmed": { "en": "Confirmed", "mr": "निश्चित" },
    "pdf_status_approved": { "en": "Approved", "mr": "मंजूर" },
    "pdf_status_pending": { "en": "Pending", "mr": "प्रलंबित" },
    "pdf_status_declared": { "en": "Declared", "mr": "घोषित" },
    "pdf_status_treasurer_approved": { "en": "Treasurer Approved", "mr": "खजिनदार मंजूर" },
    "pdf_status_president_approved": { "en": "President Approved", "mr": "अध्यक्ष मंजूर" },
    "pdf_status_rejected": { "en": "Rejected", "mr": "नाकारले" },

    "pdf_shg_amount": { "en": "SHG Amount", "mr": "गट रक्कम" },
    "pdf_bank_amount": { "en": "Bank Amount", "mr": "बँक रक्कम" },
    "pdf_shg_amt": { "en": "SHG Amt", "mr": "गट रक्कम" },
    "pdf_bank_amt": { "en": "Bank Amt", "mr": "बँक रक्कम" },
    "pdf_int_dur": { "en": "Int/Dur", "mr": "व्याज/काळ" },
    "pdf_shg_rep": { "en": "SHG Rep.", "mr": "गट परतफेड" },
    "pdf_bank_rep": { "en": "Bank Rep.", "mr": "बँक परतफेड" },
    "pdf_shg_rem": { "en": "SHG Rem.", "mr": "गट थकीत" },
    "pdf_bank_rem": { "en": "Bank Rem.", "mr": "बँक थकीत" },

    "pdf_group_code": { "en": "Group Code", "mr": "गट कोड" },
    "pdf_village": { "en": "Village", "mr": "गाव" },
    "pdf_taluka_district": { "en": "Taluka/District", "mr": "तालुका/जिल्हा" },
    "pdf_president": { "en": "President", "mr": "अध्यक्ष" },
    "pdf_treasurer": { "en": "Treasurer", "mr": "खजिनदार" },
    "pdf_generated_on_label": { "en": "Generated On", "mr": "रोजी तयार केले" },
    "pdf_language": { "en": "Language", "mr": "भाषा" },
    "pdf_generated_by_label": { "en": "Generated By", "mr": "द्वारे तयार केले" },
    "pdf_applied_filters": { "en": "Applied Filters", "mr": "लागू केलेले फिल्टर्स" },
    "pdf_official_report": { "en": "Official Report", "mr": "अधिकृत अहवाल" },
    "pdf_savings_report": { "en": "Savings Report", "mr": "बचत अहवाल" },
    "pdf_no_records_filters": { "en": "No records match the current filters.", "mr": "सध्याच्या फिल्टर्सशी जुळणाऱ्या कोणत्याही नोंदी नाहीत." },
    "pdf_grand_total": { "en": "Grand Total", "mr": "एकूण बेरीज" },
    "pdf_members_with_payments": { "en": "Members w/ Payments", "mr": "पेमेंट केलेले सदस्य" },
    "pdf_total_collected": { "en": "Total Collected", "mr": "एकूण जमा" },
    "pdf_late_fees": { "en": "Late Fees", "mr": "विलंब शुल्क" },
    "pdf_summary": { "en": "Summary", "mr": "सारांश" },
    "pdf_sr": { "en": "Sr.", "mr": "अ.क्र." },
    "pdf_member_name": { "en": "Member Name", "mr": "सदस्याचे नाव" },
    "pdf_phone": { "en": "Phone", "mr": "फोन" },
    "pdf_month": { "en": "Month", "mr": "महिना" },
    "pdf_late_fee": { "en": "Late Fee", "mr": "विलंब शुल्क" },
    "pdf_method": { "en": "Method", "mr": "पद्धत" },
    "pdf_status": { "en": "Status", "mr": "स्थिती" },
    "pdf_date": { "en": "Date", "mr": "तारीख" },
    "pdf_loans_report": { "en": "Loans Report", "mr": "कर्ज अहवाल" },
    "pdf_loan_date": { "en": "Loan Date", "mr": "कर्ज तारीख" },
    "pdf_other_loans": { "en": "Other Loans", "mr": "इतर कर्जे" },
    "pdf_total_loans": { "en": "Total Loans", "mr": "एकूण कर्जे" },
    "pdf_total_disbursed": { "en": "Total Disbursed", "mr": "एकूण वितरित" },
    "pdf_total_repaid": { "en": "Total Repaid", "mr": "एकूण परतफेड" },
    "pdf_outstanding_balance": { "en": "Outstanding Balance", "mr": "थकबाकी" },
    "pdf_loan_details": { "en": "Loan Details", "mr": "कर्जाचा तपशील" },
    "pdf_financial_summary": { "en": "Financial Summary", "mr": "आर्थिक सारांश" },
    "this_loan_uses_reducing_balance": { "en": "This loan uses the reducing balance method.", "mr": "या कर्जासाठी कमी होणाऱ्या शिल्लक पद्धतीचा वापर केला जातो." },
    "reducing_balance": { "en": "Reducing Balance", "mr": "कमी होणारी शिल्लक" },
    "repayment_summary": { "en": "Repayment Summary", "mr": "परतफेड सारांश" },
    "pdf_no_transactions_period": { "en": "No transactions in this period.", "mr": "या कालावधीत कोणतेही व्यवहार नाहीत." },
    "pdf_current_balance": { "en": "Current Balance", "mr": "सध्याची शिल्लक" },
    "pdf_total_savings": { "en": "Total Savings", "mr": "एकूण बचत" },
    "pdf_loan_disbursed": { "en": "Loans Disbursed", "mr": "कर्ज वितरित" },
    "pdf_loan_repayments": { "en": "Loan Repayments", "mr": "कर्ज परतफेड" },
    "pdf_outstanding_loans": { "en": "Outstanding Loans", "mr": "थकबाकी कर्जे" },
    "pdf_active_members": { "en": "Active Members", "mr": "सक्रिय सदस्य" },
    "pdf_total_members": { "en": "Total Members", "mr": "एकूण सदस्य" },
    "pdf_overview": { "en": "Overview", "mr": "आढावा" },
    "pdf_period_breakdown": { "en": "Period Breakdown", "mr": "कालावधीचे विभाजन" },
    "pdf_period": { "en": "Period", "mr": "कालावधी" },
    "pdf_savings": { "en": "Savings", "mr": "बचत" },
    "pdf_loans_out": { "en": "Loans Out", "mr": "दिलेले कर्ज" },
    "pdf_repayments": { "en": "Repayments", "mr": "परतफेड" },
    "pdf_net": { "en": "Net", "mr": "निव्वळ" },
    "pdf_member_register": { "en": "Member Register", "mr": "सदस्य नोंदणी" },
    "pdf_yes": { "en": "Yes", "mr": "होय" },
    "pdf_no": { "en": "No", "mr": "नाही" },
    "pdf_no_members_filter": { "en": "No members match the current filter.", "mr": "सध्याच्या फिल्टरशी जुळणारे कोणतेही सदस्य नाहीत." },
    "pdf_total": { "en": "Total", "mr": "एकूण" },
    "pdf_members_filtered": { "en": "Members (Filtered)", "mr": "सदस्य (फिल्टर केलेले)" },
    "pdf_total_contributions": { "en": "Total Contributions", "mr": "एकूण योगदान" },
    "pdf_member_list": { "en": "Member List", "mr": "सदस्यांची यादी" },
    "pdf_role": { "en": "Role", "mr": "भूमिका" },
    "pdf_joined": { "en": "Joined", "mr": "सामील झाले" },
    "pdf_total_contribution": { "en": "Total Contribution", "mr": "एकूण योगदान" },
    "pdf_pending_months": { "en": "Pending Months", "mr": "प्रलंबित महिने" },
    "pdf_active_loan": { "en": "Active Loan", "mr": "सक्रिय कर्ज" },
    "pdf_loans_done": { "en": "Loans Done", "mr": "पूर्ण झालेले कर्ज" },
    "pdf_member_statement": { "en": "Member Statement", "mr": "सदस्य विवरणपत्र" },
    "pdf_empty_row": { "en": "Empty", "mr": "रिकामे" },
    "pdf_active_loan_balance": { "en": "Active Loan Balance", "mr": "सक्रिय कर्जाची शिल्लक" },
    "pdf_meetings_attended": { "en": "Meetings Attended", "mr": "उपस्थित बैठका" },
    "pdf_attendance": { "en": "Attendance", "mr": "हजेरी" },
    "pdf_member_since": { "en": "Member Since", "mr": "पासून सदस्य" },
    "pdf_member_information": { "en": "Member Information", "mr": "सदस्याची माहिती" },
    "pdf_payment_history": { "en": "Payment History", "mr": "पेमेंट इतिहास" },
    "pdf_amount": { "en": "Amount", "mr": "रक्काम" },
    "pdf_remarks": { "en": "Remarks", "mr": "शेरा" },
    "pdf_loan_history": { "en": "Loan History", "mr": "कर्जाचा इतिहास" },
    "pdf_interest": { "en": "Interest", "mr": "व्याज" },
    "pdf_duration": { "en": "Duration", "mr": "कालावधी" },
    "pdf_repaid": { "en": "Repaid", "mr": "परतफेड केली" },
    "pdf_outstanding": { "en": "Outstanding", "mr": "थकबाकी" },
    "pdf_president_signature": { "en": "President Signature", "mr": "अध्यक्षांची स्वाक्षरी" },
    "pdf_treasurer_signature": { "en": "Treasurer Signature", "mr": "खजिनदाराची स्वाक्षरी" },
    "pdf_detailed_transactions": { "en": "Detailed Transactions", "mr": "तपशीलवार व्यवहार" },
    "pdf_monthly_installment": { "en": "Monthly Payment", "mr": "शिफारस केलेला मासिक भरणा" },
    "outstanding_principal": { "en": "Outstanding Principal", "mr": "थकीत मुद्दल" },
    "monthly_interest_rate": { "en": "Monthly Interest Rate", "mr": "मासिक व्याजदर" },
    "current_month_interest": { "en": "Current Month Interest", "mr": "चालू महिन्याचे व्याज" },
    "suggested_principal": { "en": "Suggested Principal", "mr": "सुचवलेले मुद्दल" },
    "suggested_installment": { "en": "Monthly Payment", "mr": "शिफारस केलेला मासिक भरणा" },
    "total_suggested_payment": { "en": "Total Suggested Payment", "mr": "एकूण सुचवलेला भरणा" },
    "interest_due": { "en": "Interest Due", "mr": "देय व्याज" },
    "principal_reduction": { "en": "Principal Reduction", "mr": "मुद्दल कपात" },
    "new_remaining_principal": { "en": "New Remaining Principal", "mr": "नवीन उर्वरित मुद्दल" },
    "next_month_estimated_interest": { "en": "Next Month Estimated Interest", "mr": "पुढील महिन्याचे अंदाजित व्याज" },
    "interest_paid_label": { "en": "Interest Paid", "mr": "व्याज भरले" },
    "principal_paid_label": { "en": "Principal Paid", "mr": "मुद्दल भरले" },
    "payment_entered": { "en": "Payment Entered", "mr": "रक्कम प्रविष्ट केली" },
    "outstanding_interest_remaining": { "en": "Outstanding Interest Remaining", "mr": "उर्वरित थकीत व्याज" },
    "loan_start_date": { "en": "Loan Start Date", "mr": "कर्ज सुरु झाल्याची तारीख" },
    "loan_approval_date": { "en": "Loan Approval Date", "mr": "कर्ज मंजुरीची तारीख" },
    "resolution_number": { "en": "Resolution Number", "mr": "ठराव क्रमांक" },
    "meeting_reference": { "en": "Meeting Reference", "mr": "बैठक संदर्भ" },
    "remaining_months": { "en": "Remaining Months", "mr": "उर्वरित महिने" },
    "pdf_opening_principal": { "en": "Opening Principal", "mr": "सुरुवातीचे मुद्दल" },
    "pdf_interest_charged": { "en": "Interest Charged", "mr": "आकारलेले व्याज" },
    "pdf_interest_paid": { "en": "Interest Paid", "mr": "भरलेले व्याज" },
    "pdf_principal_paid": { "en": "Principal Paid", "mr": "भरलेले मुद्दल" },
    "pdf_closing_principal": { "en": "Closing Principal", "mr": "अंतिम मुद्दल" },
    "pdf_total_payment": { "en": "Total Payment", "mr": "एकूण भरणा" },
    "total_principal_paid": { "en": "Total Principal Paid", "mr": "एकूण मुद्दल भरणा" },
    "total_interest_paid": { "en": "Total Interest Paid", "mr": "एकूण व्याज भरणा" },
    "outstanding_interest": { "en": "Outstanding Interest", "mr": "थकीत व्याज" },

    "search": { "en": "Search", "mr": "शोधा" },
    "filters": { "en": "Filters", "mr": "फिल्टर्स" },
    "month": { "en": "Month", "mr": "महिना" },
    "year": { "en": "Year", "mr": "वर्ष" },
    "payment_method": { "en": "Payment Method", "mr": "पेमेंट पद्धत" },
    "all": { "en": "All", "mr": "सर्व" },
    "cash": { "en": "Cash", "mr": "रोख" },
    "online": { "en": "Online", "mr": "ऑनलाइन" },
    "pending": { "en": "Pending", "mr": "प्रलंबित" },
    "declared": { "en": "Declared", "mr": "घोषित" },
    "confirmed": { "en": "Confirmed", "mr": "निश्चित" },
    "rejected": { "en": "Rejected", "mr": "नाकारले" },
    "remarks": { "en": "Remarks", "mr": "शेरा" },
    "enter_remarks": { "en": "Enter Remarks (Optional)", "mr": "शेरा प्रविष्ट करा (पर्यायी)" },
    "no_remarks_provided": { "en": "No remarks provided.", "mr": "कोणताही शेरा दिला नाही." },
    "rejected_by": { "en": "Rejected By", "mr": "द्वारे नाकारले" },
    "rejected_on": { "en": "Rejected On", "mr": "रोजी नाकारले" },
    "active_status": { "en": "Active", "mr": "सक्रिय" },
    "completed": { "en": "Completed", "mr": "पूर्ण झाले" },
    "pending_treasurer": { "en": "Pending Treasurer", "mr": "खजिनदार प्रलंबित" },
    "pending_president": { "en": "Pending President", "mr": "अध्यक्ष प्रलंबित" },
    "treasurer_approved": { "en": "Treasurer Approved", "mr": "खजिनदार मंजूर" },
    "president_approved": { "en": "President Approved", "mr": "अध्यक्ष मंजूर" },
    "override_history": { "en": "Override History", "mr": "अधिलिखित इतिहास" },
    "approval_timeline": { "en": "Approval Timeline", "mr": "मंजुरीचा कालरेखा" },
    "loan_requested": { "en": "Loan Requested", "mr": "कर्ज मागणी केली" },
    "treasurer_review_pending": { "en": "Treasurer Review Pending", "mr": "खजिनदाराची पुनरावलोकन प्रलंबित" },
    "treasurer_reviewed": { "en": "Treasurer Reviewed", "mr": "खजिनदाराने पुनरावलोकन केले" },
    "president_rejected": { "en": "President Rejected", "mr": "अध्यक्षाने नाकारले" },
    "direct_approve": { "en": "Direct Approve", "mr": "थेट मंजूर करा" },
    "direct_reject": { "en": "Direct Reject", "mr": "थेट नकारा" },
    "rejection_reason": { "en": "Rejection Reason", "mr": "नाकारण्याचे कारण" },
    "reject": { "en": "Reject", "mr": "नाकार" },
    "due": { "en": "Due", "mr": "थकबाकी" },
    "monthly_installment": { "en": "Recommended Monthly Payment", "mr": "शिफारस केलेला मासिक भरणा" },
    "appname": {
      "en": "SHG Records",
      "mr": "बचत गट नोंदी"
    },
    "more": {
      "en": "More",
      "mr": "अधिक"
    },
    "name": {
      "en": "Name",
      "mr": "नाव"
    },
    "phone": {
      "en": "Phone Number",
      "mr": "फोन नंबर"
    },
    "amount": {
      "en": "Amount",
      "mr": "रक्कम"
    },
    "date": {
      "en": "Date",
      "mr": "तारीख"
    },
    "status": {
      "en": "Status",
      "mr": "स्थिती"
    },
    "cancel": {
      "en": "Cancel",
      "mr": "रद्द करा"
    },
    "save": {
      "en": "Save",
      "mr": "जतन करा"
    },
    "edit": {
      "en": "Edit",
      "mr": "संपादन"
    },
    "delete": {
      "en": "Delete",
      "mr": "हटवा"
    },
    "welcome": {
      "en": "Welcome",
      "mr": "स्वागत"
    },
    "language": {
      "en": "Language",
      "mr": "भाषा"
    },
    "english": {
      "en": "English",
      "mr": "इंग्रजी"
    },
    "marathi": {
      "en": "Marathi",
      "mr": "मराठी"
    },
    "overview": {
      "en": "Overview",
      "mr": "सारांश"
    },
    "recentactivity": {
      "en": "Recent Activity",
      "mr": "अलीकडील हालचाली"
    },
    "viewall": {
      "en": "View All",
      "mr": "सर्व पहा"
    },
    "today": {
      "en": "Today",
      "mr": "आज"
    },
    "success": {
      "en": "Success",
      "mr": "यशस्वी"
    },
    "error": {
      "en": "Error",
      "mr": "त्रुटी"
    },
    "confirm": {
      "en": "Confirm",
      "mr": "पुष्टी करा"
    },
    "total": {
      "en": "Total",
      "mr": "एकूण"
    },
    "present": {
      "en": "Present",
      "mr": "उपस्थित"
    },
    "absent": {
      "en": "Absent",
      "mr": "अनुपस्थित"
    },
    "failed_generate_invite": {
      "en": "Failed to generate invite",
      "mr": "आमंत्रण तयार करण्यात अयशस्वी"
    },
    "could_not_read_image": {
      "en": "Could not read image",
      "mr": "चित्र वाचता आले नाही"
    },
    "failed_upload_qr": {
      "en": "Failed to upload QR code",
      "mr": "QR कोड अपलोड करण्यात अयशस्वी"
    },
    "app_version": {
      "en": "SHG Records v1.0",
      "mr": "बचत गट नोंदी v1.0"
    },
    "screen_not_found": {
      "en": "This screen doesn't exist.",
      "mr": "ही स्क्रीन अस्तित्वात नाही."
    },
    "go_to_home": {
      "en": "Go to home screen!",
      "mr": "मुख्य पानावर जा!"
    },
    "rs": {
      "en": "Rs.",
      "mr": "रु."
    },
    "more_plus": {
      "en": "+",
      "mr": "+"
    },
    "done": {
      "en": "Done",
      "mr": "पूर्ण झाले"
    },
    "download": {
      "en": "Download",
      "mr": "डाउनलोड"
    }
  },
  "auth": {
    "login": {
      "en": "Login",
      "mr": "लॉगिन"
    },
    "register": {
      "en": "Register",
      "mr": "नोंदणी"
    },
    "logout": {
      "en": "Logout",
      "mr": "बाहेर पडा"
    },
    "password": {
      "en": "Password",
      "mr": "पासवर्ड"
    },
    "village": {
      "en": "Village",
      "mr": "गाव"
    },
    "taluka": {
      "en": "Taluka",
      "mr": "तालुका"
    },
    "district": {
      "en": "District",
      "mr": "जिल्हा"
    },
    "joindate": {
      "en": "Join Date",
      "mr": "सामील तारीख"
    },
    "exitdate": {
      "en": "Planned Exit Date",
      "mr": "बाहेर पडण्याची तारीख"
    },
    "registeras": {
      "en": "Register as",
      "mr": "म्हणून नोंदणी करा"
    },
    "alreadyhaveaccount": {
      "en": "Already have an account?",
      "mr": "आधीच खाते आहे?"
    },
    "donthaveaccount": {
      "en": "Don't have an account?",
      "mr": "खाते नाही?"
    },
    "invalidcredentials": {
      "en": "Invalid credentials",
      "mr": "चुकीची माहिती"
    },
    "group_claimed": {
      "en": "Group already claimed",
      "mr": "गट आधीच नोंदणीकृत आहे"
    },
    "phone_registered": {
      "en": "Phone number already registered",
      "mr": "फोन नंबर आधीच नोंदणीकृत आहे"
    },
    "user_in_group": {
      "en": "User already in a group",
      "mr": "वापरकर्ता आधीच एका गटात आहे"
    },
    "invalid_invite": {
      "en": "Invalid invitation code",
      "mr": "अवैध आमंत्रण कोड"
    },
    "invite_exhausted": {
      "en": "No invitation uses left",
      "mr": "आमंत्रण मर्यादा संपली आहे"
    },
    "invite_not_found": {
      "en": "Invitation code not found",
      "mr": "आमंत्रण कोड सापडला नाही"
    }
  },
    "dashboard": {
    "monthly_loan_reminder": { "en": "Monthly Loan Repayment Due", "mr": "मासिक कर्ज हप्ता देय" },
    "multiple_active_loans": { "en": "Multiple Active Loans", "mr": "एकाधिक सक्रिय कर्ज" },
    "dismiss": { "en": "Dismiss", "mr": "काढून टाका" },
    "total_savings": { "en": "Total Savings", "mr": "एकूण बचत" },
    "current_cash_balance": { "en": "Current Cash Balance", "mr": "सध्याची रोख शिल्लक" },
    "total_principal_disbursed": { "en": "Total Principal Disbursed", "mr": "वाटप केलेले एकूण मुद्दल" },
    "principal_collected": { "en": "Principal Collected", "mr": "जमा झालेले मुद्दल" },
    "interest_collected": { "en": "Interest Collected", "mr": "जमा झालेले व्याज" },
    "outstanding_principal": { "en": "Outstanding Principal", "mr": "थकबाकी मुद्दल" },
    "outstanding_interest": { "en": "Outstanding Interest", "mr": "थकबाकी व्याज" },
    "mic_error_2": { "en": "Failed to initialize microphone for recording. Please check permissions.", "mr": "रेकॉर्डिंगसाठी माइक सुरू करण्यात अयशस्वी. कृपया परवानगी तपासा." },
    "dashboard": {
      "en": "Dashboard",
      "mr": "मुख्य पृष्ठ"
    },
    "monthlysavings": {
      "en": "Monthly Savings",
      "mr": "मासिक बचत"
    },
    "totalmembers": {
      "en": "Total Members",
      "mr": "एकूण सदस्य"
    },
    "upcomingmeeting": {
      "en": "Upcoming Meeting",
      "mr": "आगामी बैठक"
    },
    "pendingpayments": {
      "en": "Pending Payments",
      "mr": "प्रलंबित भरणा"
    },
    "activeloans": {
      "en": "Active Loans",
      "mr": "सक्रिय कर्ज"
    },
    "financial_summary": {
      "en": "Financial Summary",
      "mr": "आर्थिक सारांश"
    },
    "total_penalties": {
      "en": "Total Penalties",
      "mr": "एकूण दंड"
    },
    "loan_disbursed": {
      "en": "Loan Disbursed",
      "mr": "वितरित कर्ज"
    },
    "loan_repayments": {
      "en": "Loan Repayments",
      "mr": "कर्ज परतफेड"
    },
    "current_balance": {
      "en": "Current Balance",
      "mr": "सध्याची शिल्लक"
    },
    "totalSavings": {
      "en": "Total Savings",
      "mr": "एकूण बचत"
    },
    "something_went_wrong": {
      "en": "Something went wrong.",
      "mr": "काहीतरी चूक झाली."
    },
    "no_speech_detected": {
      "en": "No speech detected. Please try again.",
      "mr": "आवाज ऐकू आला नाही. पुन्हा प्रयत्न करा."
    },
    "mic_denied": {
      "en": "Microphone permission denied.",
      "mr": "माइक परवानगी नाकारली."
    },
    "mic_error": {
      "en": "Failed to initialize microphone. Please check permissions.",
      "mr": "माइक सुरू करण्यात अयशस्वी. कृपया परवानगी तपासा."
    },
    "voice_command": {
      "en": "Voice command",
      "mr": "व्हॉइस कमांड"
    },
    "listening": {
      "en": "Listening...",
      "mr": "ऐकत आहे..."
    },
    "processing": {
      "en": "Processing...",
      "mr": "समजत आहे..."
    }
  },
  "meetings": {
    "failed_create_meeting": { "en": "Failed to create meeting. Please try again.", "mr": "बैठक तयार करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा." },
    "meetings": {
      "en": "Meetings",
      "mr": "बैठकी"
    },
    "createmeeting": {
      "en": "Create Meeting",
      "mr": "बैठक तयार करा"
    },
    "scheduleddate": {
      "en": "Scheduled Date",
      "mr": "नियोजित तारीख"
    },
    "agenda": {
      "en": "Agenda",
      "mr": "कार्यसूची"
    },
    "notes": {
      "en": "Notes",
      "mr": "टिप्पणी"
    },
    "attendance": {
      "en": "Attendance",
      "mr": "उपस्थिती"
    },
    "nomeetings": {
      "en": "No meetings scheduled",
      "mr": "कोणतीही बैठक नियोजित नाही"
    },
    "cancelmeeting": {
      "en": "Cancel Meeting",
      "mr": "बैठक रद्द करा"
    },
    "meetingcancelled": {
      "en": "Cancelled",
      "mr": "रद्द"
    },
    "selectdate": {
      "en": "Select Date",
      "mr": "तारीख निवडा"
    },
    "scheduled": {
      "en": "Scheduled",
      "mr": "नियोजित"
    },
    "completed": {
      "en": "Completed",
      "mr": "पूर्ण"
    },
    "meetingdetails": {
      "en": "Meeting Details",
      "mr": "बैठक तपशील"
    },
    "meeting_created": {
      "en": "Meeting created successfully",
      "mr": "बैठक यशस्वीरित्या तयार झाली"
    }
  },
  "payments": {
    "payments": {
      "en": "Payments",
      "mr": "भरणा"
    },
    "nopayments": {
      "en": "No payment records",
      "mr": "कोणतीही भरणा नोंद नाही"
    },
    "paymentdeclared": {
      "en": "Payment Declared",
      "mr": "भरणा घोषित"
    },
    "declarepayment": {
      "en": "I Have Paid",
      "mr": "मी भरणा केला"
    },
    "repayment": {
      "en": "Repayment",
      "mr": "परतफेड"
    },
    "addrepayment": {
      "en": "Add Repayment",
      "mr": "परतफेड जोडा"
    },
    "cash": {
      "en": "Cash",
      "mr": "रोख"
    },
    "online": {
      "en": "Online",
      "mr": "ऑनलाइन"
    },
    "paymentmode": {
      "en": "Payment Mode",
      "mr": "भरणा प्रकार"
    },
    "selectpaymentmode": {
      "en": "How did you pay?",
      "mr": "तुम्ही कसे भरले?"
    },
    "scanandpay": {
      "en": "Scan QR & Pay",
      "mr": "QR स्कॅन करा आणि भरा"
    },
    "pending_verification": {
      "en": "Pending Treasurer Verification",
      "mr": "खजिनदाराच्या पडताळणीची प्रतीक्षा"
    },
    "payment_not_received": {
      "en": "Payment Not Received",
      "mr": "भरणा मिळाला नाही"
    },
    "verifyonlinepayment": {
      "en": "Verify Online Payment",
      "mr": "ऑनलाइन भरणा पडताळा"
    },
    "paymentreceived": {
      "en": "Payment Received",
      "mr": "भरणा मिळाला"
    },
    "paymentnotreceived": {
      "en": "Not Received",
      "mr": "मिळाला नाही"
    },
    "reopen_payment": {
      "en": "Reopen",
      "mr": "पुन्हा उघडा"
    },
    "confirm_directly": {
      "en": "Confirm Directly",
      "mr": "थेट पुष्टी करा"
    },
    "reject_again": {
      "en": "Reject Again",
      "mr": "पुन्हा नकारा"
    },
    "overridden_by_president": {
      "en": "Overridden by President",
      "mr": "अध्यक्षांनी निर्णय बदलला"
    },
    "payment_reopened": {
      "en": "Payment reopened",
      "mr": "देयक पुन्हा उघडले"
    },
    "uploadqrcode": {
      "en": "Upload QR Code",
      "mr": "QR कोड अपलोड करा"
    },
    "qrcodeuploaded": {
      "en": "QR code updated successfully",
      "mr": "QR कोड यशस्वीरित्या अपडेट झाला"
    },
    "noqrcode": {
      "en": "No QR code uploaded yet",
      "mr": "अद्याप QR कोड अपलोड केला नाही"
    },
    "qrcodeinfo": {
      "en": "Members will see this QR when paying online",
      "mr": "ऑनलाइन भरणा करताना सदस्यांना हे QR दिसेल"
    },
    "removeqrcode": {
      "en": "Remove QR Code",
      "mr": "QR कोड काढा"
    },
    "pendingverification": {
      "en": "Pending Verification",
      "mr": "पडताळणी प्रलंबित"
    },
    "paymentHistory": {
      "en": "Payment History",
      "mr": "भरणा इतिहास"
    }
  },
  "loans": {
    "enter_loan_amount_error": { "en": "Please enter a valid loan amount greater than 0", "mr": "कृपया ० पेक्षा जास्त असलेली वैध कर्ज रक्कम टाका" },
    "select_duration_error": { "en": "Please select a loan duration.", "mr": "कृपया कर्जाचा कालावधी निवडा." },
    "loans": {
      "en": "Loans",
      "mr": "कर्ज"
    },
    "requestloan": {
      "en": "Request Loan",
      "mr": "कर्ज मागणी"
    },
    "loanamount": {
      "en": "Loan Amount",
      "mr": "कर्ज रक्कम"
    },
    "interest": {
      "en": "Interest %",
      "mr": "व्याज %"
    },
    "duration": {
      "en": "Duration (months)",
      "mr": "कालावधी (महिने)"
    },
    "remaining": {
      "en": "Remaining",
      "mr": "शिल्लक"
    },
    "approve": {
      "en": "Approve",
      "mr": "मंजूर करा"
    },
    "approved": {
      "en": "Approved",
      "mr": "मंजूर"
    },
    "rejected": {
      "en": "Rejected by President",
      "mr": "अध्यक्षाने नाकारले"
    },
    "requested": {
      "en": "Requested",
      "mr": "मागणी"
    },
    "pending_treasurer": {
      "en": "Pending Treasurer Approval",
      "mr": "खजिनदाराची मंजुरी प्रलंबित"
    },
    "pending_president": {
      "en": "Pending President Approval",
      "mr": "अध्यक्षाची मंजुरी प्रलंबित"
    },
    "treasurer_rejected": {
      "en": "Rejected by Treasurer",
      "mr": "खजिनदाराने नाकारले"
    },
    "noloans": {
      "en": "No loan records",
      "mr": "कोणतीही कर्ज नोंद नाही"
    },
    "resolutionno": {
      "en": "Resolution No.",
      "mr": "ठराव क्र."
    },
    "loandetails": {
      "en": "Loan Details",
      "mr": "कर्ज तपशील"
    },
    "totalloan": {
      "en": "Total Loan",
      "mr": "एकूण कर्ज"
    },
    "outstanding": {
      "en": "Outstanding",
      "mr": "बाकी रक्कम"
    },
    "loanpolicy": {
      "en": "Loan Policy",
      "mr": "कर्ज धोरण"
    },
    "smallloan": {
      "en": "Small Loan",
      "mr": "लहान कर्ज"
    },
    "mediumloan": {
      "en": "Medium Loan",
      "mr": "मध्यम कर्ज"
    },
    "largeloan": {
      "en": "Large Loan",
      "mr": "मोठे कर्ज"
    },
    "loanHistory": {
      "en": "Loan History",
      "mr": "कर्ज इतिहास"
    },
    "mo": {
      "en": "mo",
      "mr": "म"
    },
    "totalLoan": {
      "en": "Total Loan",
      "mr": "एकूण कर्ज"
    },
    "rule_msg": {
      "en": "Amount exceeds max limit for {n} months",
      "mr": "{n} महिन्यांसाठी रक्कम कमाल मर्यादेपेक्षा जास्त आहे"
    },
    "auto_interest_applied": {
      "en": "Interest automatically applied based on group rules.",
      "mr": "गटाच्या नियमांनुसार व्याज आपोआप लागू केले."
    }
  },
  "members": {
    "remove_treasurer_confirm": { "en": "Remove {name} as Treasurer?", "mr": "{name} यांना खजिनदार पदावरून काढायचे?" },
    "assign_treasurer_confirm": { "en": "Assign {name} as the group Treasurer?", "mr": "{name} यांना गटाचे खजिनदार म्हणून नियुक्त करायचे?" },
    "president": {
      "en": "President",
      "mr": "अध्यक्ष"
    },
    "member": {
      "en": "Member",
      "mr": "सदस्य"
    },
    "members": {
      "en": "Members",
      "mr": "सदस्य"
    },
    "active": {
      "en": "Active",
      "mr": "सक्रिय"
    },
    "left": {
      "en": "Left",
      "mr": "बाहेर पडले"
    },
    "pending": {
      "en": "Pending",
      "mr": "प्रलंबित"
    },
    "confirmed": {
      "en": "Confirmed",
      "mr": "पुष्टी"
    },
    "verify": {
      "en": "Verify",
      "mr": "सत्यापित करा"
    },
    "reject": {
      "en": "Reject",
      "mr": "नाकारा"
    },
    "treasurer": {
      "en": "Treasurer",
      "mr": "खजिनदार"
    },
    "assigntreasurer": {
      "en": "Assign Treasurer",
      "mr": "खजिनदार नियुक्त करा"
    },
    "changetreasurer": {
      "en": "Change Treasurer",
      "mr": "खजिनदार बदला"
    },
    "removetreasurer": {
      "en": "Remove Treasurer",
      "mr": "खजिनदार काढा"
    },
    "notreasurer": {
      "en": "No Treasurer Assigned",
      "mr": "खजिनदार नियुक्त नाही"
    },
    "currenttreasurer": {
      "en": "Current Treasurer",
      "mr": "सध्याचे खजिनदार"
    },
    "treasurerapprove": {
      "en": "Approve (Treasurer)",
      "mr": "मंजूर करा (खजिनदार)"
    },
    "treasurerreject": {
      "en": "Reject (Treasurer)",
      "mr": "नाकारा (खजिनदार)"
    },
    "nomembers": {
      "en": "No members yet",
      "mr": "अद्याप सदस्य नाहीत"
    },
    "memberdetails": {
      "en": "Member Details",
      "mr": "सदस्य तपशील"
    },
    "editmember": {
      "en": "Edit Member",
      "mr": "सदस्य संपादन"
    },
    "markasleft": {
      "en": "Mark as Left",
      "mr": "बाहेर पडले म्हणून नोंदवा"
    },
    "markasactive": {
      "en": "Mark as Active",
      "mr": "सक्रिय म्हणून नोंदवा"
    },
    "presidentonly": {
      "en": "Only President can do this",
      "mr": "फक्त अध्यक्ष हे करू शकतात"
    },
    "membernotfound": {
      "en": "Member not found",
      "mr": "सदस्य सापडला नाही"
    },
    "confirmMarkLeft": {
      "en": "Mark this member as left?",
      "mr": "या सदस्याला बाहेर पडले म्हणून नोंदवायचे?"
    },
    "confirmMarkActive": {
      "en": "Mark this member as active?",
      "mr": "या सदस्याला सक्रिय म्हणून नोंदवायचे?"
    },
    "remove_from_group": {
      "en": "Remove from group",
      "mr": "गटातून काढा"
    },
    "reactivate": {
      "en": "Reactivate",
      "mr": "पुन्हा सक्रिय करा"
    },
    "invite": {
      "en": "Invite",
      "mr": "आमंत्रित करा"
    },
    "invite_member": {
      "en": "Invite Member",
      "mr": "सदस्याला आमंत्रित करा"
    },
    "share_code": {
      "en": "Share this code with the new member:",
      "mr": "हा कोड नवीन सदस्यासोबत शेअर करा:"
    },
    "code_valid_1": {
      "en": "This code is valid for 1 registration.",
      "mr": "हा कोड १ नोंदणीसाठी वैध आहे."
    },
    "generate_new_code": {
      "en": "Generate new code",
      "mr": "नवीन कोड तयार करा"
    },
    "generate": {
      "en": "Generate",
      "mr": "तयार करा"
    },
    "new_code": {
      "en": "New code generated!",
      "mr": "नवीन कोड तयार झाला!"
    },
    "invite_member_desc": {
      "en": "Share this code with the new member to allow them to join.",
      "mr": "नवीन सदस्याला सामील होण्यासाठी हा कोड शेअर करा."
    }
  },
  "groups": {
    "groupid": {
      "en": "Group ID",
      "mr": "गट क्रमांक"
    },
    "creategroup": {
      "en": "Create Group",
      "mr": "गट तयार करा"
    },
    "joingroup": {
      "en": "Join Group",
      "mr": "गटात सामील व्हा"
    },
    "entergroupid": {
      "en": "Enter Group ID to join",
      "mr": "सामील होण्यासाठी गट क्रमांक टाका"
    },
    "setgroupid": {
      "en": "Set a unique Group ID",
      "mr": "अद्वितीय गट क्रमांक ठरवा"
    },
    "groupname": {
      "en": "Group Name",
      "mr": "गटाचे नाव"
    },
    "groupnotfound": {
      "en": "Group ID not found",
      "mr": "गट क्रमांक सापडला नाही"
    },
    "groupidtaken": {
      "en": "Group ID already taken",
      "mr": "गट क्रमांक आधीच वापरात आहे"
    },
    "invalidorexpiredcode": {
      "en": "Invalid or expired group code",
      "mr": "अवैध किंवा कालबाह्य गट कोड"
    }
  },
  "settings": {
    "grouprules": {
      "en": "Group Rules",
      "mr": "गटाचे नियम"
    },
    "editrules": {
      "en": "Edit Rules",
      "mr": "नियम संपादन"
    },
    "norulesset": {
      "en": "No rules set yet",
      "mr": "अद्याप नियम ठरवलेले नाहीत"
    },
    "loansettings": {
      "en": "Loan Settings",
      "mr": "कर्ज सेटिंग्ज"
    },
    "interestrate": {
      "en": "Interest Rate (%)",
      "mr": "व्याज दर (%)"
    },
    "maxloanamount": {
      "en": "Max Loan Amount (Rs.)",
      "mr": "कमाल कर्ज रक्कम (रु.)"
    },
    "durationrules": {
      "en": "Duration Rules",
      "mr": "कालावधी नियम"
    },
    "durationrule": {
      "en": "Duration Rule",
      "mr": "कालावधी नियम"
    },
    "uptoamount": {
      "en": "Up to Amount (Rs.)",
      "mr": "रकमेपर्यंत (रु.)"
    },
    "minmonths": {
      "en": "Min Duration (months)",
      "mr": "किमान कालावधी (महिने)"
    },
    "maxmonths": {
      "en": "Max Duration (months)",
      "mr": "कमाल कालावधी (महिने)"
    },
    "addrule": {
      "en": "Add Rule",
      "mr": "नियम जोडा"
    },
    "removerule": {
      "en": "Remove",
      "mr": "काढा"
    },
    "savesettings": {
      "en": "Save Settings",
      "mr": "सेटिंग्ज जतन करा"
    },
    "settingssaved": {
      "en": "Settings saved successfully",
      "mr": "सेटिंग्ज यशस्वीरित्या जतन झाले"
    },
    "autointerest": {
      "en": "Interest auto-applied by group",
      "mr": "गटाद्वारे व्याज आपोआप लागू"
    },
    "durationhint": {
      "en": "Allowed duration",
      "mr": "परवानगी कालावधी"
    },
    "exceedsmaxloan": {
      "en": "Amount exceeds the group's max loan limit",
      "mr": "रक्कम गटाच्या कमाल कर्ज मर्यादेपेक्षा जास्त आहे"
    },
    "durationtooshort": {
      "en": "Duration is below the minimum for this amount",
      "mr": "कालावधी या रकमेसाठी किमानपेक्षा कमी आहे"
    },
    "durationtoolong": {
      "en": "Duration exceeds the maximum for this amount",
      "mr": "कालावधी या रकमेसाठी कमालपेक्षा जास्त आहे"
    },
    "invalidamount": {
      "en": "Please enter a valid amount",
      "mr": "कृपया वैध रक्कम टाका"
    },
    "resetdefaults": {
      "en": "Reset to Defaults",
      "mr": "डीफॉल्टवर रीसेट करा"
    },
    "contribution_settings": {
      "en": "Contribution Settings",
      "mr": "योगदान सेटिंग्ज"
    },
    "monthly_contribution": {
      "en": "Monthly Contribution Amount",
      "mr": "मासिक योगदान रक्कम"
    },
    "contribution_due_day": {
      "en": "Contribution Due Day",
      "mr": "योगदान देय तारीख"
    },
    "th_of_month": {
      "en": "th of Month",
      "mr": "व्या तारखेला"
    },
    "grace_period_days": {
      "en": "Grace Period (Days)",
      "mr": "सवलत कालावधी (दिवस)"
    },
    "days": {
      "en": "Days",
      "mr": "दिवस"
    },
    "late_fee_setup": {
      "en": "Late Fee Setup",
      "mr": "विलंब शुल्क सेटिंग्ज"
    },
    "fixed_amount": {
      "en": "Fixed Amount",
      "mr": "निश्चित रक्कम"
    },
    "percentage": {
      "en": "Percentage",
      "mr": "टक्केवारी"
    },
    "percent_of_expected": {
      "en": "% of Expected",
      "mr": "% अपेक्षित रकमेच्या"
    },
    "enter_group_rules": {
      "en": "Enter group rules here...",
      "mr": "गटाचे नियम येथे लिहा..."
    }
  },
  "reports": {
    "downloadstatement": {
      "en": "Download Full Statement (PDF)",
      "mr": "संपूर्ण विवरणपत्र डाउनलोड करा (PDF)"
    },
    "generatingpdf": {
      "en": "Generating PDF...",
      "mr": "PDF तयार होत आहे..."
    },
    "totalsavings": {
      "en": "Total Savings",
      "mr": "एकूण बचत"
    },
    "active_loans": { "en": "Active Loans", "mr": "सक्रिय कर्जे" },
    "completed_loans": { "en": "Completed Loans", "mr": "पूर्ण कर्जे" },
    "financial_summary": { "en": "Financial Summary", "mr": "आर्थिक सारांश" },
    "member_register": { "en": "Member Register", "mr": "सदस्य नोंदणी" },
    "time_range": { "en": "Time Range", "mr": "वेळ श्रेणी" },
    "custom_date_range": { "en": "Custom Date Range", "mr": "सानुकूल तारीख" },
    "start_date": { "en": "Start Date", "mr": "प्रारंभ तारीख" },
    "end_date": { "en": "End Date", "mr": "शेवटची तारीख" },
    "payment_method": { "en": "Payment Method", "mr": "पेमेंट पद्धत" },
    "loan_status": { "en": "Loan Status", "mr": "कर्ज स्थिती" },
    "member_status": { "en": "Member Status", "mr": "सदस्य स्थिती" },
    "treasurer_approved": { "en": "Treasurer Approved", "mr": "खजिनदार मंजूर" },
    "president_approved": { "en": "President Approved", "mr": "अध्यक्ष मंजूर" },
    "pending_loans": { "en": "Pending Loans", "mr": "प्रलंबित कर्ज" },
    "rejected_loans": { "en": "Rejected Loans", "mr": "नाकारलेले कर्ज" },
    "active_members": { "en": "Active Members", "mr": "सक्रिय सदस्य" },
    "inactive_members": { "en": "Inactive Members", "mr": "निष्क्रिय सदस्य" },
    "members_active_loans": { "en": "Members with Active Loans", "mr": "सक्रिय कर्ज असलेले सदस्य" },
    "members_completed_loans": { "en": "Members with Completed Loans", "mr": "पूर्ण कर्ज असलेले सदस्य" },
    "members_pending_payments": { "en": "Members with Pending Payments", "mr": "प्रलंबित पेमेंट असलेले सदस्य" },
    "members_overdue_payments": { "en": "Members with Overdue Payments", "mr": "थकबाकी पेमेंट असलेले सदस्य" },
    "filters": { "en": "Filters", "mr": "फिल्टर्स" },
    "applied_filters": { "en": "Applied Filters", "mr": "लागू केलेले फिल्टर्स" },
    "page": { "en": "Page", "mr": "पृष्ठ" },
    "all_time": { "en": "All Time", "mr": "सर्व वेळ" },
    "no_records_found": {
      "en": "No records found for the selected filters.",
      "mr": "निवडलेल्या फिल्टरसाठी कोणत्याही नोंदी आढळल्या नाहीत."
    },
    "group_reports": {
      "en": "Group Reports",
      "mr": "गट अहवाल"
    },
    "download_desc": {
      "en": "Download and share official SHG reports as PDF.",
      "mr": "अधिकृत बचत गट अहवाल PDF स्वरूपात डाउनलोड आणि शेअर करा."
    },
    "failed_savings_report": {
      "en": "Failed to generate savings report",
      "mr": "बचत अहवाल तयार करण्यात अयशस्वी"
    },
    "failed_loans_report": {
      "en": "Failed to generate loans report",
      "mr": "कर्ज अहवाल तयार करण्यात अयशस्वी"
    },
    "monthly_savings_report": {
      "en": "Monthly Savings Report",
      "mr": "मासिक बचत अहवाल"
    },
    "active_loans_report": {
      "en": "Active Loans Report",
      "mr": "सक्रिय कर्ज अहवाल"
    }
  },
  "validation": {
    "valid_monthly_contribution": {
      "en": "Please enter a valid monthly contribution amount",
      "mr": "कृपया योग्य मासिक योगदान रक्कम टाका"
    },
    "due_day_range": {
      "en": "Due day must be between 1 and 28",
      "mr": "देय तारीख 1 ते 28 च्या दरम्यान असावी"
    },
    "late_fee_positive": {
      "en": "Late fee must be 0 or greater",
      "mr": "विलंब शुल्क 0 किंवा त्याहून अधिक असावे"
    },
    "grace_period_positive": {
      "en": "Grace period must be 0 or greater",
      "mr": "सवलत कालावधी 0 किंवा त्याहून अधिक असावा"
    },
    "at_least_one_rule": {
      "en": "At least one duration rule is required",
      "mr": "किमान एक कालावधी नियम आवश्यक आहे"
    },
    "interest_rate_range": {
      "en": "Interest rate must be between 0.1 and 100",
      "mr": "व्याज दर 0.1 ते 100 च्या दरम्यान असावा"
    },
    "valid_max_loan": {
      "en": "Please enter a valid max loan amount",
      "mr": "कृपया योग्य कमाल कर्ज रक्कम टाका"
    },
    "min_duration_one": {
      "en": "Min duration must be at least 1",
      "mr": "किमान कालावधी किमान 1 असावा"
    },
    "max_duration_greater": {
      "en": "Max duration must be ≥ min duration",
      "mr": "कमाल कालावधी किमान पेक्षा जास्त असावा"
    },
    "enter_valid_amount": {
      "en": "Enter a valid amount",
      "mr": "योग्य रक्कम टाका"
    },
    "fill_date_agenda": {
      "en": "Please fill date and agenda",
      "mr": "कृपया तारीख आणि कार्यसूची भरा"
    },
    "select_valid_date": {
      "en": "Please select a valid date",
      "mr": "कृपया योग्य तारीख निवडा"
    },
    "group_name_required": {
      "en": "Group name is required",
      "mr": "गटाचे नाव आवश्यक आहे"
    },
    "fill_all_fields": {
      "en": "Please fill all fields",
      "mr": "कृपया सर्व माहिती भरा"
    },
    "phone_10_digits": {
      "en": "Phone number must be exactly 10 digits",
      "mr": "मोबाइल नंबर 10 अंकांचा असणे आवश्यक आहे"
    },
    "enter_group_code": {
      "en": "Please enter group code",
      "mr": "कृपया गट कोड टाका"
    },
    "enter_invite_code": {
      "en": "Please enter invitation code",
      "mr": "कृपया आमंत्रण कोड टाका"
    },
    "enter_valid_amount_rule": {
      "en": "Rule {n}: Enter a valid amount",
      "mr": "नियम {n}: वैध रक्कम टाका"
    },
    "min_duration_one_rule": {
      "en": "Rule {n}: Min duration must be at least 1",
      "mr": "नियम {n}: किमान कालावधी १ असावा"
    },
    "max_duration_greater_rule": {
      "en": "Rule {n}: Max duration must be ≥ min duration",
      "mr": "नियम {n}: कमाल कालावधी किमानपेक्षा जास्त असावा"
    }
  },
  "superAdmin": {
    "failed_fetch_groups": {
      "en": "Failed to fetch groups",
      "mr": "गट प्राप्त करण्यात अयशस्वी"
    },
    "failed_create_group": {
      "en": "Failed to create group",
      "mr": "गट तयार करण्यात अयशस्वी"
    },
    "failed_update_status": {
      "en": "Failed to update status",
      "mr": "स्थिती अद्यतनित करण्यात अयशस्वी"
    },
    "platform_groups": {
      "en": "Platform Groups",
      "mr": "प्लॅटफॉर्म वरील गट"
    },
    "group_name": {
      "en": "Group Name",
      "mr": "गटाचे नाव"
    },
    "code": {
      "en": "Code",
      "mr": "कोड"
    },
    "status": {
      "en": "Status",
      "mr": "स्थिती"
    },
    "president": {
      "en": "President",
      "mr": "अध्यक्ष"
    },
    "actions": {
      "en": "Actions",
      "mr": "कृती"
    },
    "claimed": {
      "en": "Claimed",
      "mr": "नोंदणीकृत"
    },
    "unclaimed": {
      "en": "Unclaimed",
      "mr": "प्रलंबित"
    },
    "shg_name": {
      "en": "SHG Name",
      "mr": "बचत गटाचे नाव"
    },
    "group_created": {
      "en": "Group created! Code:",
      "mr": "गट तयार झाला! कोड:"
    },
    "generate_code": {
      "en": "Generate Code",
      "mr": "कोड तयार करा"
    },
    "deactivate": {
      "en": "Deactivate",
      "mr": "निष्क्रिय करा"
    },
    "activate": {
      "en": "Activate",
      "mr": "सक्रिय करा"
    }
  },
  "auto": {

    "language": { "en": "Language", "mr": "भाषा" },
    "mr": {
      "en": "mr",
      "mr": "en"
    },
    "empty": {
      "en": "मराठी",
      "mr": "English"
    },
    "self_help_group_record_platform": {
      "en": "Self Help Group Record Platform",
      "mr": "बचत गट नोंद व्यवस्थापन"
    },
    "group_code_e_g_shg": {
      "en": "Group Code (e.g. SHG-A8A253A1)",
      "mr": "गट कोड (उदा. SHG-A8A253A1)"
    },
    "invitation_code": {
      "en": "Invitation Code",
      "mr": "आमंत्रण कोड"
    },
    "permission_to_access_photos_is": {
      "en": "Permission to access photos is required.",
      "mr": "फोटो ऍक्सेस परवानगी आवश्यक आहे."
    },
    "remove_the_qr_code": {
      "en": "Remove the QR code?",
      "mr": "QR कोड काढायचे?"
    },
    "qr_payment_code": {
      "en": "QR Payment Code",
      "mr": "QR भरणा कोड"
    },
    "replace": {
      "en": "Replace",
      "mr": "बदला"
    },
    "uploading": {
      "en": "Uploading...",
      "mr": "अपलोड होत आहे..."
    },
    "group": {
      "en": "Group",
      "mr": "गट"
    },
      "history": {
    "loan_repayment": { "en": "Loan Repayment", "mr": "कर्ज परतफेड" },
    "amount_paid": { "en": "Amount Paid", "mr": "भरलेली रक्कम" },
    "principal_portion": { "en": "Principal Portion", "mr": "मुद्दल रक्कम" },
    "interest_portion": { "en": "Interest Portion", "mr": "व्याज रक्कम" },
    "remaining_principal": { "en": "Remaining Principal", "mr": "उर्वरित मुद्दल" },
    "receipt_number": { "en": "Receipt No", "mr": "पावती क्रमांक" },
    "recorded_by": { "en": "Recorded By", "mr": "नोंदणीकृत" },

      "en": "History",
      "mr": "इतिहास"
    },
    "shg_settings": {
      "en": "SHG Settings",
      "mr": "गट सेटिंग्ज"
    },
    "loan_settings": {
      "en": "Loan Settings",
      "mr": "कर्ज सेटिंग्ज"
    },
    "group_reports": {
      "en": "Group Reports",
      "mr": "गट अहवाल"
    },
    "reminder": {
      "contribution_pending_title": { "en": "Monthly Contribution Pending", "mr": "मासिक योगदान प्रलंबित" },
      "contribution_amount": { "en": "Contribution Amount", "mr": "योगदान रक्कम" },
      "due_date": { "en": "Due Date", "mr": "देय तारीख" },
      "days_remaining": { "en": "Days Remaining", "mr": "दिवस शिल्लक" },
      "overdue_by": { "en": "overdue by", "mr": "उशीर झाला" },
      "days": { "en": "days", "mr": "दिवस" },
      "late_fee_applicable": { "en": "Late fee", "mr": "विलंब शुल्क" },
      "total_payable": { "en": "total payable", "mr": "एकूण देय" },
      "pay_now": { "en": "pay now", "mr": "आता भरा" },
      "no_late_fee": { "en": "no late fee", "mr": "विलंब शुल्क नाही" },
      "within_grace": { "en": "within grace period", "mr": "सवलत कालावधीत" },
      "submitted_title": { "en": "payment submitted", "mr": "पेमेंट सादर केले" },
      "submitted_subtitle": { "en": "awaiting treasurer verification", "mr": "खजिनदार सत्यापनाची प्रतीक्षा" },
      "view_payment": { "en": "view payment", "mr": "पेमेंट पहा" },
      "submitted_amount": { "en": "amount submitted", "mr": "सादर केलेली रक्कम" },
      "submitted_on": { "en": "submitted on", "mr": "रोजी सादर केले" },
      "payment_method": { "en": "method", "mr": "पद्धत" },
      "rejected_title": { "en": "payment rejected", "mr": "पेमेंट नाकारले" },
      "rejection_reason_label": { "en": "reason", "mr": "कारण" },
      "no_reason_given": { "en": "no reason provided", "mr": "कोणतेही कारण दिले नाही" },
      "resubmit": { "en": "resubmit payment", "mr": "पुन्हा पेमेंट सादर करा" }
    },
    "english": {
      "en": "English / मराठी",
      "mr": "मराठी / English"
    },
    "are_you_sure_you_want": {
      "en": "Are you sure you want to logout?",
      "mr": "तुम्ही खात्री आहात का?"
    },
    "delete": {
      "en": "Delete",
      "mr": "हटवा"
    },
    "no_qr_code_available_contact": {
      "en": "No QR code available. Contact your Treasurer to upload one.",
      "mr": "QR कोड उपलब्ध नाही. खजिनदाराला अपलोड करण्यास सांगा."
    },
    "tap_to_enlarge": {
      "en": "Tap to enlarge",
      "mr": "मोठे करण्यासाठी टॅप करा"
    },
    "i_have_paid": {
      "en": "I have paid",
      "mr": "मी भरणा केला"
    },
    "tap_anywhere_to_close": {
      "en": "Tap anywhere to close",
      "mr": "बंद करण्यासाठी टॅप करा"
    },
    "delete_payment": {
      "en": "Delete Payment?",
      "mr": "देयक हटवायचे?"
    },
    "this_payment_record_will_be": {
      "en": "This payment record will be permanently deleted.",
      "mr": "ही देयक नोंद कायमची हटवली जाईल."
    },
    "super_admin_panel": {
      "en": "Super Admin Panel",
      "mr": "सुपर अॅडमिन पॅनेल"
    },
    "logout": {
      "en": "Logout",
      "mr": "लॉगआउट"
    },
    "create_new_shg": {
      "en": "Create New SHG",
      "mr": "नवीन बचत गट तयार करा"
    },
    "reactivate": {
      "en": "Reactivate",
      "mr": "सक्रिय करा"
    },
    "suspend": {
      "en": "Suspend",
      "mr": "निलंबित करा"
    },
    "please_enter_a_valid_duration": {
      "en": "Please enter a valid duration",
      "mr": "कृपया वैध कालावधी टाका"
    },
    "please_enter_your_password": {
      "en": "Please enter your password",
      "mr": "कृपया पासवर्ड टाका"
    },
    "incorrect_password": {
      "en": "Incorrect password",
      "mr": "चुकीचा पासवर्ड"
    },
    "interest": {
      "en": "Interest",
      "mr": "व्याज"
    },
    "max_loan": {
      "en": "Max Loan",
      "mr": "कमाल कर्ज"
    },
    "months": {
      "en": "months",
      "mr": "महिने"
    },
    "password_verification_required_before_submitting": {
      "en": "Password verification required before submitting",
      "mr": "सबमिट करण्यापूर्वी पासवर्ड सत्यापन आवश्यक"
    },
    "verify_identity": {
      "en": "Verify Identity",
      "mr": "ओळख सत्यापित करा"
    },
    "enter_your_password_to_confirm": {
      "en": "Enter your password to confirm this loan request",
      "mr": "या कर्ज मागणीची पुष्टी करण्यासाठी पासवर्ड टाका"
    },
    "amount": {
      "en": "Amount",
      "mr": "रक्कम"
    },
    "duration": {
      "en": "Duration",
      "mr": "कालावधी"
    },
    "mo": {
      "en": "mo",
      "mr": "म."
    },
    "enter_password": {
      "en": "Enter password",
      "mr": "पासवर्ड टाका"
    },
    "meeting_agenda": {
      "en": "Meeting agenda...",
      "mr": "बैठक कार्यसूची..."
    },
    "additional_notes": {
      "en": "Additional notes...",
      "mr": "अतिरिक्त टिप्पणी..."
    },
    "verified_by": {
      "en": "Verified by",
      "mr": "सत्यापित"
    },
    "repayments": {
      "en": "repayments",
      "mr": "परतफेड"
    },
    "meeting": {
      "en": "Meeting",
      "mr": "बैठक"
    },
    "attended": {
      "en": "attended",
      "mr": "उपस्थित"
    },
    "present": {
      "en": "Present",
      "mr": "उपस्थित"
    },
    "absent": {
      "en": "Absent",
      "mr": "अनुपस्थित"
    },
    "all": {
      "en": "All",
      "mr": "सर्व"
    },
    "loan_not_found": {
      "en": "Loan not found",
      "mr": "कर्ज सापडले नाही"
    },
    "treasurer_approved_forwarded_to_president": {
      "en": "Treasurer approved · forwarded to President",
      "mr": "खजिनदाराने मंजूर केले · अध्यक्षाकडे पाठवले"
    },
    "repaid": {
      "en": "repaid",
      "mr": "परतफेड"
    },
    "treasurer_decision": {
      "en": "Treasurer Decision",
      "mr": "खजिनदाराचा निर्णय"
    },
    "your_decision_will_be_forwarded": {
      "en": "Your decision will be forwarded to the President if you approve.",
      "mr": "आपण मंजूर केल्यास निर्णय अध्यक्षाकडे पाठवला जाईल."
    },
    "president_s_final_decision": {
      "en": "President's Final Decision",
      "mr": "अध्यक्षाचा अंतिम निर्णय"
    },
    "enter_resolution_number": {
      "en": "Enter resolution number",
      "mr": "ठराव क्रमांक टाका"
    },
    "resolution_number_is_required": {
      "en": "Resolution number is required",
      "mr": "ठराव क्रमांक आवश्यक आहे"
    },
    "no_repayments_yet": {
      "en": "No repayments yet",
      "mr": "अद्याप परतफेड नाही"
    },
    "total_repaid": {
      "en": "Total Repaid",
      "mr": "एकूण परतफेड"
    },
    "delete_loan": {
      "en": "Delete Loan",
      "mr": "कर्ज हटवा"
    },
    "approve_loan_request": {
      "en": "Approve Loan Request?",
      "mr": "कर्ज मागणी मंजूर करायची?"
    },
    "this_will_forward_the_request": {
      "en": "This will forward the request to the President for final approval.",
      "mr": "हे विनंती अंतिम मंजुरीसाठी अध्यक्षाकडे पाठवेल."
    },
    "reject_loan_request": {
      "en": "Reject Loan Request?",
      "mr": "कर्ज मागणी नाकारायची?"
    },
    "the_member_will_be_notified": {
      "en": "The member will be notified that their request was rejected by the treasurer.",
      "mr": "सदस्याला कळवले जाईल की त्यांची मागणी खजिनदाराने नाकारली."
    },
    "reject_this_loan": {
      "en": "Reject This Loan?",
      "mr": "हे कर्ज नाकारायचे?"
    },
    "the_member_will_be_notified_1": {
      "en": "The member will be notified that their loan request was rejected.",
      "mr": "सदस्याला कळवले जाईल की त्यांची कर्ज मागणी नाकारली गेली."
    },
    "delete_repayment": {
      "en": "Delete Repayment?",
      "mr": "परतफेड हटवायची?"
    },
    "this_repayment_record_will_be": {
      "en": "This repayment record will be permanently deleted.",
      "mr": "ही परतफेड नोंद कायमची हटवली जाईल."
    },
    "delete_loan_1": {
      "en": "Delete Loan?",
      "mr": "कर्ज कायमचे हटवायचे?"
    },
    "this_loan_record_will_be": {
      "en": "This loan record will be permanently deleted and cannot be recovered.",
      "mr": "ही कर्ज नोंद कायमची हटवली जाईल आणि पुनर्प्राप्त करता येणार नाही."
    },
    "keep": {
      "en": "Keep",
      "mr": "ठेवा"
    },
    "reset_all_loan_settings_to": {
      "en": "Reset all loan settings to defaults?",
      "mr": "सर्व कर्ज सेटिंग्ज डीफॉल्टवर रीसेट करायचे?"
    },
    "reset": {
      "en": "Reset",
      "mr": "रीसेट"
    },
    "applied_automatically_to_all_new": {
      "en": "Applied automatically to all new loan requests",
      "mr": "सर्व नवीन कर्ज मागण्यांना आपोआप लागू होते"
    },
    "no_member_can_request_a": {
      "en": "No member can request a loan above this amount",
      "mr": "कोणताही सदस्य या रकमेपेक्षा जास्त कर्ज मागू शकत नाही"
    },
    "set_allowed_duration_range_based": {
      "en": "Set allowed duration range based on loan amount. Rules are sorted by amount automatically.",
      "mr": "कर्ज रकमेनुसार परवानगी कालावधी श्रेणी सेट करा. नियम रकमेनुसार आपोआप क्रमवारी लावले जातात."
    },
    "meeting_not_found": {
      "en": "Meeting not found",
      "mr": "बैठक सापडली नाही"
    },
    "delete_meeting": {
      "en": "Delete Meeting",
      "mr": "बैठक हटवा"
    },
    "cancel_meeting": {
      "en": "Cancel Meeting?",
      "mr": "बैठक रद्द करायची?"
    },
    "the_meeting_will_be_marked": {
      "en": "The meeting will be marked as cancelled. Members will see it as cancelled.",
      "mr": "बैठक रद्द म्हणून चिन्हांकित केली जाईल. सदस्यांना ती रद्द म्हणून दिसेल."
    },
    "yes_cancel": {
      "en": "Yes, Cancel",
      "mr": "हो, रद्द करा"
    },
    "delete_meeting_1": {
      "en": "Delete Meeting?",
      "mr": "बैठक कायमची हटवायची?"
    },
    "this_meeting_will_be_permanently": {
      "en": "This meeting will be permanently deleted and cannot be recovered.",
      "mr": "ही बैठक कायमची हटवली जाईल आणि पुनर्प्राप्त करता येणार नाही."
    },
    "future_loan_requests_will_require": {
      "en": "Future loan requests will require Treasurer approval before reaching the President.",
      "mr": "भविष्यातील कर्ज मागण्या अध्यक्षाकडे पोहोचण्यापूर्वी खजिनदाराच्या मंजुरीची आवश्यकता असेल."
    },
    "generate_a_unique_invitation_code": {
      "en": "Generate a unique invitation code for a new member to join this group.",
      "mr": "या गटामध्ये सामील होण्यासाठी नवीन सदस्यासाठी एक अद्वितीय आमंत्रण कोड तयार करा."
    },
    "detailed_view_of_all_members": {
      "en": "Detailed view of all members' expected and collected contributions.",
      "mr": "सर्व सदस्यांच्या अपेक्षित आणि जमा झालेल्या बचतीचे सविस्तर विवरण."
    },
    "overview_of_all_active_loans": {
      "en": "Overview of all active loans, interest, and outstanding balances.",
      "mr": "सर्व सक्रिय कर्जे, व्याज आणि बाकी रकमेचा आढावा."
    },
    "filters": {
      "select_month": { "en": "select month", "mr": "महिना निवडा" },
      "select_year": { "en": "select year", "mr": "वर्ष निवडा" },
      "select_status": { "en": "select status", "mr": "स्थिती निवडा" },
      "select_method": { "en": "select method", "mr": "पद्धत निवडा" },
      "all_months": { "en": "all months", "mr": "सर्व महिने" },
      "all_years": { "en": "all years", "mr": "सर्व वर्षे" },
      "all_statuses": { "en": "all statuses", "mr": "सर्व स्थिती" },
      "all_methods": { "en": "all methods", "mr": "सर्व पद्धती" },
      "jan": { "en": "jan", "mr": "जाने" },
      "feb": { "en": "feb", "mr": "फेब्रु" },
      "mar": { "en": "mar", "mr": "मार्च" },
      "apr": { "en": "apr", "mr": "एप्रिल" },
      "may": { "en": "may", "mr": "मे" },
      "jun": { "en": "jun", "mr": "जून" },
      "jul": { "en": "jul", "mr": "जुलै" },
      "aug": { "en": "aug", "mr": "ऑग" },
      "sep": { "en": "sep", "mr": "सप्टे" },
      "oct": { "en": "oct", "mr": "ऑक्टो" },
      "nov": { "en": "nov", "mr": "नोव्हे" },
      "dec": { "en": "dec", "mr": "डिसें" }
    }
  },
  "bank": {
    "bank_assisted_loan": { "en": "Bank Assisted Loan", "mr": "बँक सहाय्यित कर्ज" },
    "bank_portion": { "en": "Bank Portion", "mr": "बँकेचा हिस्सा" },
    "shg_portion": { "en": "SHG Portion", "mr": "गटाचा हिस्सा" },
    "affiliated_banks": { "en": "Affiliated Banks", "mr": "संलग्न बँका" },
    "bank_name": { "en": "Bank Name", "mr": "बँकेचे नाव" },
    "bank_branch": { "en": "Branch", "mr": "शाखा" },
    "ifsc_code": { "en": "IFSC Code", "mr": "IFSC कोड" },
    "contact_person": { "en": "Contact Person", "mr": "संपर्क व्यक्ती" },
    "contact_number": { "en": "Contact Number", "mr": "संपर्क क्रमांक" },
    "bank_notes": { "en": "Notes", "mr": "नोंदी" },
    "bank_active": { "en": "Active", "mr": "सक्रिय" },
    "bank_inactive": { "en": "Inactive", "mr": "निष्क्रिय" },
    "add_bank": { "en": "Add Bank", "mr": "बँक जोडा" },
    "edit_bank": { "en": "Edit Bank", "mr": "बँक संपादित करा" },
    "no_banks_configured": { "en": "No affiliated banks configured yet.", "mr": "अद्याप कोणत्याही संलग्न बँका कॉन्फिगर केल्या नाहीत." },
    "no_active_banks": { "en": "No active banks available. Please add a bank in SHG Settings first.", "mr": "कोणतीही सक्रिय बँक उपलब्ध नाही." },
    "bank_principal": { "en": "Bank Principal", "mr": "बँकेचे मूळ कर्ज" },
    "bank_interest": { "en": "Bank Interest Rate", "mr": "बँक व्याजदर" },
    "bank_duration": { "en": "Bank Duration", "mr": "बँक कालावधी" },
    "bank_emi": { "en": "Monthly Bank EMI", "mr": "मासिक बँक हप्ता" },
    "shg_emi": { "en": "Monthly SHG EMI", "mr": "मासिक गट हप्ता" },
    "total_monthly": { "en": "Total Monthly Repayment", "mr": "एकूण मासिक परतफेड" },
    "bank_outstanding": { "en": "Bank Outstanding", "mr": "बँकेची थकीत रक्कम" },
    "shg_outstanding": { "en": "SHG Outstanding", "mr": "गटाची थकीत रक्कम" },
    "combined_outstanding": { "en": "Combined Outstanding", "mr": "एकूण थकीत रक्कम" },
    "bank_repayment": { "en": "Bank Repayment", "mr": "बँक परतफेड" },
    "shg_repayment": { "en": "SHG Repayment", "mr": "गट परतफेड" },
    "total_repaid": { "en": "Total Paid", "mr": "एकूण भरणा" },
    "loan_source": { "en": "Loan Source", "mr": "कर्ज स्रोत" },
    "shg_only": { "en": "SHG Only", "mr": "केवळ गट" },
    "shg_and_bank": { "en": "SHG + Bank", "mr": "गट + बँक" },
    "select_bank": { "en": "Select Bank", "mr": "बँक निवडा" },
    "bank_loan_amount": { "en": "Bank Loan Amount", "mr": "बँकेची कर्ज रक्कम" },
    "bank_interest_rate": { "en": "Bank Interest Rate (% /month)", "mr": "बँक व्याजदर (% /महिना)" },
    "bank_loan_duration": { "en": "Bank Loan Duration (months)", "mr": "बँक कर्ज कालावधी (महिने)" },
    "bank_loan_remarks": { "en": "Bank Loan Remarks (optional)", "mr": "बँक कर्ज शेरा (पर्यायी)" },
    "deactivate_bank": { "en": "Deactivate Bank", "mr": "बँक निष्क्रिय करा" },
    "bank_name_required": { "en": "Bank name is required.", "mr": "बँकेचे नाव आवश्यक आहे." },
    "bank_required": { "en": "Please select a bank.", "mr": "कृपया बँक निवडा." },
    "bank_amount_required": { "en": "Bank loan amount must be greater than 0.", "mr": "बँकेची कर्ज रक्कम 0 पेक्षा जास्त असणे आवश्यक आहे." },
    "bank_duration_required": { "en": "Bank loan duration must be greater than 0.", "mr": "बँकेचा कर्ज कालावधी 0 पेक्षा जास्त असणे आवश्यक आहे." },
    "shg_repayment_amount": { "en": "SHG Repayment Amount", "mr": "गट परतफेड रक्कम" },
    "bank_repayment_amount": { "en": "Bank Repayment Amount", "mr": "बँक परतफेड रक्कम" },
    "enter_at_least_one": { "en": "Enter at least one repayment amount.", "mr": "किमान एक परतफेड रक्कम प्रविष्ट करा." },
    "shg_income": { "en": "SHG Income", "mr": "गटाचे उत्पन्न" },
    "bank_collections": { "en": "Bank Collections (Pass-through)", "mr": "बँकेचे संकलन (पास-थ्रू)" },
    "combined_collected": { "en": "Combined Amount Collected", "mr": "एकूण संकलित रक्कम" },
    "bank_total_repayable": { "en": "Bank Total Repayable", "mr": "बँकेची एकूण परतफेड रक्कम" },
    "shg_total_repayable": { "en": "SHG Total Repayable", "mr": "गटाची एकूण परतफेड रक्कम" },
    "pdf_bank_repayment": { "en": "Bank Repayment", "mr": "बँक परतफेड" },
    "pdf_shg_repayment": { "en": "SHG Repayment", "mr": "गट परतफेड" },
    "pdf_total_paid": { "en": "Total Paid", "mr": "एकूण भरणा" },
    "pdf_bank_outstanding": { "en": "Bank Outstanding", "mr": "बँकेची थकीत रक्कम" },
    "pdf_shg_outstanding": { "en": "SHG Outstanding", "mr": "गटाची थकीत रक्कम" },
    "pdf_combined_outstanding": { "en": "Combined Outstanding", "mr": "एकूण थकीत रक्कम" },
    "pdf_bank_section": { "en": "Bank Assisted Loan Details", "mr": "बँक सहाय्यित कर्ज तपशिल" },
    "pdf_repayment_passbook": { "en": "Repayment Passbook", "mr": "परतफेड पासबुक" },
    "pdf_loan_source": { "en": "Loan Source", "mr": "कर्ज स्रोत" },
    "pdf_bank_collections": { "en": "Bank Collections (Pass-through)", "mr": "बँकेचे संकलन (पास-थ्रू)" },
    "pdf_shg_income_only": { "en": "SHG Income (excl. bank)", "mr": "गटाचे उत्पन्न (बँक वगळून)" }
  }
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = getItemSync("shg_language");
    return (saved === "mr" ? "mr" : "en") as Language;
  });

  useEffect(() => {
    let active = true;
    getItem("shg_language").then((saved) => {
      if (active && saved === "mr" && language !== "mr") setLanguageState("mr");
      if (active && saved === "en" && language !== "en") setLanguageState("en");
    });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    await setItem("shg_language", lang).catch(() => { });

    try {
      const token = await getToken();
      if (token) {
        await apiPatch("/api/users/language", { preferredLanguage: lang });
      }
    } catch (e) {
      console.log("Failed to sync language to backend", e);
    }
  }, []);

  // Pre-calculate flattened translations once
  const flattenedTranslations = (() => {
    const flat: Record<string, any> = {};
    const traverse = (obj: any) => {
      for (const k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
          if ('en' in obj[k] && 'mr' in obj[k]) {
            flat[k.toLowerCase()] = obj[k];
          } else {
            traverse(obj[k]);
          }
        }
      }
    };
    traverse(translations);
    return flat;
  })();

  const t = useCallback(
    (key: string): string => {
      const originalKey = key;
      const initialLanguage = language;

      const keys = key.split('.');
      let result: any = translations;
      let found = true;
      for (const k of keys) {
        if (result && result[k]) {
          result = result[k];
        } else {
          found = false;
          break;
        }
      }

      if (found && result && typeof result === 'object' && result[language]) {
        console.log({ key: originalKey, language: initialLanguage, resolvedValue: result[language], resolutionType: 'nested_exact_match' });
        return result[language];
      }

      const lastKey = keys[keys.length - 1].toLowerCase();
      const fullKey = key.toLowerCase();
      const flatResult = flattenedTranslations[lastKey] || flattenedTranslations[fullKey];
      if (flatResult && flatResult[language]) {
        console.log({ key: originalKey, language: initialLanguage, resolvedValue: flatResult[language], resolutionType: 'flattened_fallback' });
        return flatResult[language];
      }

      if (key.includes('_')) {
        const formatted = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        console.log({ key: originalKey, language: initialLanguage, resolvedValue: formatted, resolutionType: 'formatter_fallback' });
        return formatted;
      }

      console.log({ key: originalKey, language: initialLanguage, resolvedValue: undefined, resolutionType: 'unresolved_fallback_to_key' });
      return key;
    },
    [language, flattenedTranslations]
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

export function getEffectiveLanguage(user: any, group: any): string {
  if (user?.preferredLanguage) return user.preferredLanguage;
  if (group?.preferredLanguage) return group.preferredLanguage;
  return "mr";
}
