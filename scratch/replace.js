const fs = require('fs');

let c = fs.readFileSync('app/loan/[id].tsx', 'utf8');

const oldListStart = c.indexOf('{displayEntries.length > 0 ? (');
const oldListEnd = c.indexOf('</View>', c.indexOf('{repayments.length > 0 && (', oldListStart)) + 7;

const newLedgerUI = `
            {displayEntries.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Ionicons name="document-outline" size={32} color={Colors.light.textMuted} />
                <Text style={{ color: Colors.light.textMuted, marginTop: 8 }}>{t("auto.no_repayments_yet")}</Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <View>
                  {/* Table Header */}
                  <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 90 }]}>{t("date") || "Date"}</Text>
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("receipt_no") || "Receipt No."}</Text>}
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 120 }]}>{t("particulars") || "Particulars"}</Text>
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 120 }]}>{t("opening_principal") || "Opening Prin."}</Text>}
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("interest_charged") || "Int. Charged"}</Text>}
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("interest_paid_label") || "Int. Paid"}</Text>}
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("principal_paid_label") || "Prin. Paid"}</Text>}
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 110 }]}>{t("total_payment") || "Total Payment"}</Text>
                    <Text style={[styles.tableCell, styles.tableHeaderText, { width: 120 }]}>{t("closing_principal") || "Closing Prin."}</Text>
                    {isReducingBalance && <Text style={[styles.tableCell, styles.tableHeaderText, { width: 130 }]}>{t("outstanding_interest") || "Outs. Int."}</Text>}
                  </View>

                  {/* Table Rows */}
                  {displayEntries.map((r, idx) => {
                    const isDisb = isReducingBalance && r.type === "disbursement";
                    return (
                      <View key={r.id || idx} style={[styles.tableRow, isDisb && { backgroundColor: Colors.light.success + "12" }, idx % 2 === 1 && !isDisb && { backgroundColor: Colors.light.inputBg }]}>
                        <Text style={[styles.tableCell, { width: 90 }]}>{new Date(isReducingBalance ? r.date : r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</Text>
                        
                        {isReducingBalance && (
                          <Text style={[styles.tableCell, { width: 110, color: Colors.light.primary }]}>{isDisb ? "-" : r.receiptNo || "-"}</Text>
                        )}
                        
                        <Text style={[styles.tableCell, { width: 120, fontFamily: "Poppins_500Medium" }]}>
                          {isReducingBalance ? (isDisb ? t("ledger_loan_disbursed") || "Loan Disbursed" : t("ledger_repayment") || "Repayment") : "Repayment"}
                        </Text>
                        
                        {isReducingBalance && (
                          <>
                            <Text style={[styles.tableCell, { width: 120 }]}>{r.openingPrincipal?.toLocaleString("en-IN") || "-"}</Text>
                            <Text style={[styles.tableCell, { width: 110 }]}>{r.interestCharged?.toLocaleString("en-IN") || "-"}</Text>
                            <Text style={[styles.tableCell, { width: 110 }]}>{r.interestPaid?.toLocaleString("en-IN") || "-"}</Text>
                            <Text style={[styles.tableCell, { width: 110 }]}>{r.principalPaid?.toLocaleString("en-IN") || "-"}</Text>
                          </>
                        )}

                        <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_600SemiBold" }]}>
                          {isReducingBalance ? (r.paymentReceived?.toLocaleString("en-IN") || "-") : r.amount?.toLocaleString("en-IN")}
                        </Text>
                        
                        <Text style={[styles.tableCell, { width: 120, color: (isReducingBalance ? r.closingPrincipal : r.runRem) > 0 ? Colors.light.danger : Colors.light.success, fontFamily: "Poppins_600SemiBold" }]}>
                          {isReducingBalance ? r.closingPrincipal?.toLocaleString("en-IN") : r.runRem?.toLocaleString("en-IN")}
                        </Text>

                        {isReducingBalance && (
                          <Text style={[styles.tableCell, { width: 130, color: r.outstandingInterest > 0 ? Colors.light.danger : Colors.light.success }]}>
                            {r.outstandingInterest?.toLocaleString("en-IN") || "0"}
                          </Text>
                        )}
                      </View>
                    );
                  })}

                  {/* Settlement Summary Footer */}
                  {loan.status === "completed" && (
                    <View style={[styles.tableRow, { backgroundColor: Colors.light.primary + "20", borderTopWidth: 2, borderTopColor: Colors.light.primary }]}>
                       <Text style={[styles.tableCell, { width: isReducingBalance ? 90 + 110 + 120 + 120 + 110 : 90 + 120, fontFamily: "Poppins_700Bold" }]}>{t("total") || "Total"}</Text>
                       {isReducingBalance && (
                         <>
                           <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_700Bold" }]}>{(loan.totalInterestPaid || 0).toLocaleString("en-IN")}</Text>
                           <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_700Bold" }]}>{(loan.totalPrincipalPaid || 0).toLocaleString("en-IN")}</Text>
                         </>
                       )}
                       <Text style={[styles.tableCell, { width: 110, fontFamily: "Poppins_700Bold" }]}>
                         {isReducingBalance ? ((loan.totalPrincipalPaid || 0) + (loan.totalInterestPaid || 0)).toLocaleString("en-IN") : totalRepaid.toLocaleString("en-IN")}
                       </Text>
                       <Text style={[styles.tableCell, { width: 120, fontFamily: "Poppins_700Bold" }]}>0</Text>
                       {isReducingBalance && <Text style={[styles.tableCell, { width: 130, fontFamily: "Poppins_700Bold" }]}>0</Text>}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* Final Settlement Display if Completed */}
            {loan.status === "completed" && (
              <View style={{ marginTop: 24, backgroundColor: Colors.light.success + "15", padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.success + "50" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Ionicons name="checkmark-done-circle" size={24} color={Colors.light.success} />
                  <Text style={{ fontFamily: "Poppins_700Bold", fontSize: 16, color: Colors.light.success }}>{t("fully_repaid") || "Fully Repaid & Settled"}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary }}>{t("loanAmount")}</Text><Text style={{ fontFamily: "Poppins_600SemiBold", color: Colors.light.text }}>Rs. {loan.amount.toLocaleString("en-IN")}</Text></View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary }}>{t("total_principal_paid")}</Text><Text style={{ fontFamily: "Poppins_600SemiBold", color: Colors.light.text }}>Rs. {(loan.totalPrincipalPaid || loan.amount).toLocaleString("en-IN")}</Text></View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_500Medium", color: Colors.light.textSecondary }}>{t("total_interest_paid")}</Text><Text style={{ fontFamily: "Poppins_600SemiBold", color: Colors.light.text }}>Rs. {(loan.totalInterestPaid || 0).toLocaleString("en-IN")}</Text></View>
                  <View style={{ borderTopWidth: 1, borderTopColor: Colors.light.border, marginVertical: 4 }} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontFamily: "Poppins_700Bold", color: Colors.light.text }}>{t("total_amount_repaid") || "Total Amount Repaid"}</Text><Text style={{ fontFamily: "Poppins_700Bold", color: Colors.light.primary }}>Rs. {isReducingBalance ? ((loan.totalPrincipalPaid || 0) + (loan.totalInterestPaid || 0)).toLocaleString("en-IN") : totalRepaid.toLocaleString("en-IN")}</Text></View>
                </View>
              </View>
            )}
`;

c = c.substring(0, oldListStart) + newLedgerUI + c.substring(oldListEnd);

if (!c.includes('tableRow:')) {
  c = c.replace(/const styles = StyleSheet\.create\(\{/, \`const styles = StyleSheet.create({
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.light.border + "80", paddingVertical: 8 },
  tableHeader: { backgroundColor: Colors.light.primary + "15" },
  tableCell: { paddingHorizontal: 8, fontSize: 12, fontFamily: "Poppins_400Regular", color: Colors.light.text },
  tableHeaderText: { fontFamily: "Poppins_600SemiBold", color: Colors.light.primary, fontSize: 11 },\`);
}

fs.writeFileSync('app/loan/[id].tsx', c);
console.log('Done replacement!');
