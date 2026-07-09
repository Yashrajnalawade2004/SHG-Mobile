import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';

export type DatePickerMode = 'date' | 'month' | 'year' | 'month-year' | 'date-range';

interface SHGDatePickerProps {
  mode?: DatePickerMode;
  value?: string; // YYYY-MM-DD or YYYY-MM or YYYY or YYYY-MM-DD:YYYY-MM-DD for range
  onSelect: (date: string) => void;
  placeholder?: string;
  minimumDate?: string;
  maximumDate?: string;
  disabled?: boolean;
  style?: any;
  icon?: keyof typeof Ionicons.glyphMap;
}

const MONTHS_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS_KEYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];

export default function SHGDatePicker({
  mode = 'date',
  value = '',
  onSelect,
  placeholder,
  minimumDate,
  maximumDate,
  disabled = false,
  style,
  icon = 'calendar-outline'
}: SHGDatePickerProps) {
  const { t } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);
  
  const initialDate = value && value.length >= 4 ? new Date(value.split(':')[0]) : new Date();
  if (isNaN(initialDate.getTime())) initialDate.setTime(Date.now());
  
  const [currentViewDate, setCurrentViewDate] = useState(initialDate);
  const [rangeStart, setRangeStart] = useState<string | null>(mode === 'date-range' && value ? value.split(':')[0] : null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(mode === 'date-range' && value && value.includes(':') ? value.split(':')[1] : null);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handleDaySelect = (day: number) => {
    const selected = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), day);
    const dateStr = selected.toISOString().split('T')[0];

    if (mode === 'date') {
      onSelect(dateStr);
      setModalVisible(false);
    } else if (mode === 'date-range') {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(dateStr);
        setRangeEnd(null);
      } else {
        if (new Date(dateStr) < new Date(rangeStart)) {
          setRangeStart(dateStr);
          setRangeEnd(rangeStart);
        } else {
          setRangeEnd(dateStr);
        }
      }
    }
  };

  const handleConfirmRange = () => {
    if (rangeStart && rangeEnd) {
      onSelect(`${rangeStart}:${rangeEnd}`);
      setModalVisible(false);
    }
  };

  const handleMonthSelect = (monthIdx: number) => {
    if (mode === 'month') {
      onSelect(String(monthIdx + 1).padStart(2, '0'));
      setModalVisible(false);
    } else if (mode === 'month-year') {
      onSelect(`${currentViewDate.getFullYear()}-${String(monthIdx + 1).padStart(2, '0')}`);
      setModalVisible(false);
    } else {
      const nd = new Date(currentViewDate);
      nd.setMonth(monthIdx);
      setCurrentViewDate(nd);
    }
  };

  const handleYearSelect = (year: number) => {
    if (mode === 'year') {
      onSelect(String(year));
      setModalVisible(false);
    } else {
      const nd = new Date(currentViewDate);
      nd.setFullYear(year);
      setCurrentViewDate(nd);
    }
  };

  const renderDays = () => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const blanks = Array.from({ length: firstDay }, (_, i) => <View key={`blank-${i}`} style={styles.dayCell} />);
    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      
      let isSelected = false;
      let inRange = false;
      if (mode === 'date') isSelected = value === dStr;
      if (mode === 'date-range') {
        isSelected = rangeStart === dStr || rangeEnd === dStr;
        if (rangeStart && rangeEnd && dStr > rangeStart && dStr < rangeEnd) {
          inRange = true;
        }
      }

      let isDateDisabled = false;
      if (minimumDate && dStr < minimumDate) isDateDisabled = true;
      if (maximumDate && dStr > maximumDate) isDateDisabled = true;

      return (
        <Pressable
          key={day}
          style={[
            styles.dayCell,
            isSelected && styles.dayCellSelected,
            inRange && styles.dayCellInRange,
            isDateDisabled && { opacity: 0.3 }
          ]}
          onPress={() => !isDateDisabled && handleDaySelect(day)}
          disabled={isDateDisabled}
        >
          <Text style={[styles.dayText, isSelected && { color: '#fff' }]}>{day}</Text>
        </Pressable>
      );
    });

    return [...blanks, ...days];
  };

  const renderMonths = () => {
    return MONTHS_KEYS.map((mKey, i) => {
      const mStr = String(i + 1).padStart(2, '0');
      let isSelected = false;
      if (mode === 'month') isSelected = value === mStr;
      if (mode === 'month-year') isSelected = value === `${currentViewDate.getFullYear()}-${mStr}`;

      return (
        <Pressable key={i} style={[styles.monthYearCell, isSelected && styles.cellSelected]} onPress={() => handleMonthSelect(i)}>
          <Text style={[styles.monthYearText, isSelected && { color: '#fff' }]}>{t(`date_${mKey}`) || mKey}</Text>
        </Pressable>
      );
    });
  };

  const renderYears = () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i);
    
    return years.map((y) => {
      const isSelected = mode === 'year' ? value === String(y) : currentViewDate.getFullYear() === y;
      
      return (
        <Pressable key={y} style={[styles.monthYearCell, isSelected && styles.cellSelected]} onPress={() => handleYearSelect(y)}>
          <Text style={[styles.monthYearText, isSelected && { color: '#fff' }]}>{y}</Text>
        </Pressable>
      );
    });
  };

  let displayValue = placeholder || t("selectDate") || "Select Date";
  if (value) {
    if (mode === 'date-range' && value.includes(':')) {
      displayValue = `${value.split(':')[0]} ${t('date_to') || 'to'} ${value.split(':')[1]}`;
    } else if (mode === 'month-year') {
      const [y, m] = value.split('-');
      displayValue = `${t(`date_${MONTHS_KEYS[parseInt(m)-1]}`)} ${y}`;
    } else {
      displayValue = value;
    }
  }

  const handleOpen = () => {
    if (!disabled) setModalVisible(true);
  };

  return (
    <>
      <Pressable 
        style={[styles.inputContainer, style, disabled && { opacity: 0.6, backgroundColor: Colors.light.background }]} 
        onPress={handleOpen}
        disabled={disabled}
      >
        <Ionicons name={icon} size={20} color={Colors.light.textSecondary} style={styles.inputIcon} />
        <Text style={[styles.inputText, !value && { color: Colors.light.textMuted }]}>{displayValue}</Text>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{mode === 'date-range' ? (t('date_select_range') || 'Select Range') : (t('selectDate') || 'Select Date')}</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.light.text} />
              </Pressable>
            </View>

            {(mode === 'date' || mode === 'date-range') && (
              <>
                <View style={styles.navigation}>
                  <Pressable onPress={() => { const d = new Date(currentViewDate); d.setMonth(d.getMonth() - 1); setCurrentViewDate(d); }} accessibilityLabel={t('date_prev_month')}>
                    <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
                  </Pressable>
                  <Text style={styles.navText}>{t(`date_${MONTHS_KEYS[currentViewDate.getMonth()]}`)} {currentViewDate.getFullYear()}</Text>
                  <Pressable onPress={() => { const d = new Date(currentViewDate); d.setMonth(d.getMonth() + 1); setCurrentViewDate(d); }} accessibilityLabel={t('date_next_month')}>
                    <Ionicons name="chevron-forward" size={24} color={Colors.light.text} />
                  </Pressable>
                </View>
                <View style={styles.daysHeader}>
                  {DAYS_KEYS.map(d => <Text key={d} style={styles.dayHeaderText}>{t(`date_day_${d}`) || d}</Text>)}
                </View>
                <View style={styles.grid}>{renderDays()}</View>
                
                <View style={styles.actionRow}>
                  {mode === 'date-range' ? (
                    <Pressable style={[styles.confirmBtn, (!rangeStart || !rangeEnd) && { opacity: 0.5 }]} disabled={!rangeStart || !rangeEnd} onPress={handleConfirmRange}>
                      <Text style={styles.confirmBtnText}>{t('date_done') || 'Done'}</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.clearBtn} onPress={() => { onSelect(''); setModalVisible(false); }}>
                      <Text style={styles.clearBtnText}>{t('date_clear') || 'Clear'}</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.todayBtn} onPress={() => {
                    const today = new Date();
                    setCurrentViewDate(today);
                    if (mode === 'date') handleDaySelect(today.getDate());
                  }}>
                    <Text style={styles.todayBtnText}>{t('date_today') || 'Today'}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {(mode === 'month' || mode === 'month-year') && (
              <>
                {mode === 'month-year' && (
                  <View style={styles.navigation}>
                    <Pressable onPress={() => { const d = new Date(currentViewDate); d.setFullYear(d.getFullYear() - 1); setCurrentViewDate(d); }}>
                      <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
                    </Pressable>
                    <Text style={styles.navText}>{currentViewDate.getFullYear()}</Text>
                    <Pressable onPress={() => { const d = new Date(currentViewDate); d.setFullYear(d.getFullYear() + 1); setCurrentViewDate(d); }}>
                      <Ionicons name="chevron-forward" size={24} color={Colors.light.text} />
                    </Pressable>
                  </View>
                )}
                <View style={styles.grid}>{renderMonths()}</View>
              </>
            )}

            {mode === 'year' && (
              <ScrollView style={{ maxHeight: 300 }}><View style={styles.grid}>{renderYears()}</View></ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.card,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: { marginRight: 12 },
  inputText: { fontSize: 15, fontFamily: "Poppins_400Regular", color: Colors.light.text, flex: 1 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalContent: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20
  },
  modalTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  navigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  navText: { fontSize: 16, fontFamily: "Poppins_600SemiBold", color: Colors.light.text },
  daysHeader: { flexDirection: 'row', marginBottom: 10 },
  dayHeaderText: { flex: 1, textAlign: 'center', color: Colors.light.textSecondary, fontSize: 12, fontFamily: "Poppins_500Medium" },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', marginVertical: 2 },
  dayCellSelected: { backgroundColor: Colors.light.primary, borderRadius: 20 },
  dayCellInRange: { backgroundColor: Colors.light.primary + '30' },
  dayText: { fontSize: 14, fontFamily: "Poppins_400Regular", color: Colors.light.text },
  monthYearCell: { width: '33.33%', paddingVertical: 15, alignItems: 'center' },
  cellSelected: { backgroundColor: Colors.light.primary, borderRadius: 12 },
  monthYearText: { fontSize: 14, fontFamily: "Poppins_500Medium", color: Colors.light.text },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  confirmBtn: { backgroundColor: Colors.light.primary, padding: 12, borderRadius: 12, alignItems: 'center', flex: 1, marginRight: 8 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  clearBtn: { backgroundColor: Colors.light.border, padding: 12, borderRadius: 12, alignItems: 'center', flex: 1, marginRight: 8 },
  clearBtnText: { color: Colors.light.text, fontSize: 15, fontFamily: "Poppins_500Medium" },
  todayBtn: { backgroundColor: Colors.light.primary + '20', padding: 12, borderRadius: 12, alignItems: 'center', flex: 1, marginLeft: 8 },
  todayBtnText: { color: Colors.light.primary, fontSize: 15, fontFamily: "Poppins_600SemiBold" },
});
