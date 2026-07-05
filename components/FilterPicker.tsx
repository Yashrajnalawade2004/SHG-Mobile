/**
 * FilterPicker - mobile-friendly dropdown filter for Payments and Loans screens.
 *
 * Web   : native <select> overlaid with styled view (OS handles dropdown natively)
 * Native: Modal bottom-sheet with a scrollable option list
 *
 * Props:
 *   label    - field label / placeholder shown when no value selected
 *   value    - current selected option value
 *   options  - [{ value, label }]; first item is the "all" / empty option
 *   onChange - callback with new value string
 *   icon     - optional Ionicons icon name
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, FlatList,
  Platform, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

export interface FilterOption {
  value: string;
  label: string;
}

interface FilterPickerProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: string;
  accentColor?: string;
}

// ─── Web ─────────────────────────────────────────────────────────────────────
function WebSelect({ label, value, options, onChange, icon, accentColor }: FilterPickerProps) {
  const color = accentColor ?? Colors.light.primary;
  const isActive = value !== options[0]?.value;
  const selected = options.find(o => o.value === value);

  return (
    // @ts-ignore - web position relative needed for select overlay
    <View style={[ws.wrapper, isActive && { borderColor: color, backgroundColor: color + '12' }]}>
      {icon && (
        <Ionicons name={icon as any} size={13} color={isActive ? color : Colors.light.textMuted} />
      )}
      <Text style={[ws.label, isActive && { color }]} numberOfLines={1}>
        {selected?.label ?? label}
      </Text>
      <Ionicons name="chevron-down" size={12} color={isActive ? color : Colors.light.textMuted} />
      {/* @ts-ignore — web-only native <select> overlaid transparently */}
      <select
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        style={{
          // Explicit TRBL instead of `inset` for Firefox <87 compatibility
          position: 'absolute',
          top: 0, right: 0, bottom: 0, left: 0,
          opacity: 0,
          cursor: 'pointer',
          width: '100%',
          height: '100%',
          // Reset Firefox's default select rendering
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          margin: 0,
          padding: 0,
          border: 'none',
          background: 'transparent',
        } as any}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

    </View>
  );
}

const ws = StyleSheet.create({
  wrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: Colors.light.card,
    position: 'relative', overflow: 'hidden',
    minWidth: 88,
  },
  label: {
    fontFamily: 'Poppins_500Medium', fontSize: 12,
    color: Colors.light.textSecondary, flex: 1,
  },
});

// ─── Native ───────────────────────────────────────────────────────────────────
function NativeSelect({ label, value, options, onChange, icon, accentColor }: FilterPickerProps) {
  const [open, setOpen] = useState(false);
  const color = accentColor ?? Colors.light.primary;
  const selected = options.find(o => o.value === value);
  const isActive = value !== options[0]?.value;

  return (
    <>
      <Pressable
        style={[ns.trigger, isActive && { borderColor: color, backgroundColor: color + '12' }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {icon && (
          <Ionicons name={icon as any} size={13} color={isActive ? color : Colors.light.textMuted} />
        )}
        <Text style={[ns.triggerLabel, isActive && { color }]} numberOfLines={1}>
          {selected?.label ?? label}
        </Text>
        <Ionicons name="chevron-down" size={12} color={isActive ? color : Colors.light.textMuted} />
      </Pressable>

      <Modal
        visible={open} transparent animationType="slide"
        onRequestClose={() => setOpen(false)} statusBarTranslucent
      >
        <Pressable style={ns.backdrop} onPress={() => setOpen(false)} />
        <View style={ns.sheet}>
          <View style={ns.handle} />
          <Text style={ns.sheetTitle}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={item => item.value}
            style={{ maxHeight: 380 }}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <TouchableOpacity
                  style={[ns.option, active && { backgroundColor: color + '12' }]}
                  onPress={() => { onChange(item.value); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[ns.optionText, active && { color, fontFamily: 'Poppins_600SemiBold' }]}>
                    {item.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color={color} />}
                </TouchableOpacity>
              );
            }}
          />
          <Pressable style={ns.cancelBtn} onPress={() => setOpen(false)}>
            <Text style={ns.cancelText}>cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const ns = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1,
    borderColor: Colors.light.border, backgroundColor: Colors.light.card,
    minWidth: 88,
  },
  triggerLabel: {
    fontFamily: 'Poppins_500Medium', fontSize: 12,
    color: Colors.light.textSecondary, flex: 1,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.light.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, paddingTop: 12, paddingHorizontal: 4,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.light.border,
    alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: 'Poppins_600SemiBold', fontSize: 16,
    color: Colors.light.text, paddingHorizontal: 20, marginBottom: 8,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 10, marginHorizontal: 8, marginBottom: 2,
  },
  optionText: {
    fontFamily: 'Poppins_400Regular', fontSize: 15,
    color: Colors.light.text, flex: 1,
  },
  cancelBtn: {
    marginTop: 8, marginHorizontal: 20, paddingVertical: 14,
    alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.light.border,
  },
  cancelText: {
    fontFamily: 'Poppins_500Medium', fontSize: 15, color: Colors.light.textMuted,
  },
});

export default function FilterPicker(props: FilterPickerProps) {
  if (Platform.OS === 'web') return <WebSelect {...props} />;
  return <NativeSelect {...props} />;
}
