import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Contacts from "expo-contacts";
import { Feather } from "@expo/vector-icons";
import { COLORS } from "../theme";
import { MESSAGE_TEMPLATES } from "../messageTemplates";
import DateField from "./DateField";

const EMPTY_FORM = { name: "", phoneNumber: "", month: null, day: null, message: "" };

export default function BirthdayFormModal({ visible, initialValues, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const isEditing = Boolean(initialValues);

  useEffect(() => {
    if (visible) {
      setForm(
        initialValues
          ? {
              name: initialValues.name,
              phoneNumber: initialValues.phoneNumber,
              month: initialValues.month,
              day: initialValues.day,
              message: initialValues.message,
            }
          : EMPTY_FORM,
      );
    }
  }, [visible, initialValues]);

  async function pickFromContacts() {
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return;

      const phone = contact.phoneNumbers?.[0]?.number;
      setForm((f) => ({
        ...f,
        name: contact.name || f.name,
        phoneNumber: phone ? phone.replace(/[^\d+]/g, "") : f.phoneNumber,
        month: contact.birthday?.month || f.month,
        day: contact.birthday?.day || f.day,
      }));
    } catch (err) {
      Alert.alert("Erreur Contacts", err.message);
    }
  }

  const { name, phoneNumber, month, day, message } = form;
  const isValid = Boolean(name && phoneNumber && month && day && message);

  function handleSubmit() {
    if (!isValid) {
      Alert.alert("Informations manquantes", "Remplis tous les champs.");
      return;
    }
    onSubmit({ name, phoneNumber, month, day, message });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerAction}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? "Modifier l'anniversaire" : "Ajouter un anniversaire"}
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={!isValid}>
            <Text
              style={[
                styles.headerAction,
                isValid ? styles.headerActionPrimary : styles.headerActionDisabled,
              ]}
            >
              Enregistrer
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.contactButton} onPress={pickFromContacts}>
            <Feather name="user-plus" size={16} color={COLORS.accent} />
            <Text style={styles.contactButtonText}>Choisir dans Contacts</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Nom"
            placeholderTextColor={COLORS.faintText}
            value={form.name}
            onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Téléphone (+33612345678)"
            placeholderTextColor={COLORS.faintText}
            keyboardType="phone-pad"
            value={form.phoneNumber}
            onChangeText={(phoneNumber) => setForm((f) => ({ ...f, phoneNumber }))}
          />

          <DateField
            month={form.month}
            day={form.day}
            onChange={({ month, day }) => setForm((f) => ({ ...f, month, day }))}
          />

          <Text style={styles.sectionLabel}>MESSAGE</Text>
          <View style={styles.templateRow}>
            {MESSAGE_TEMPLATES.map((t) => (
              <TouchableOpacity
                key={t.label}
                style={[
                  styles.templateChip,
                  form.message === t.text && styles.templateChipActive,
                ]}
                onPress={() => setForm((f) => ({ ...f, message: t.text }))}
              >
                <Text
                  style={[
                    styles.templateChipText,
                    form.message === t.text && styles.templateChipTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Message personnalisé"
            placeholderTextColor={COLORS.faintText}
            multiline
            value={form.message}
            onChangeText={(message) => setForm((f) => ({ ...f, message }))}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  headerAction: { fontSize: 15, color: COLORS.subtext },
  headerActionPrimary: { color: COLORS.accent, fontWeight: "700" },
  headerActionDisabled: { color: COLORS.faintText, fontWeight: "700" },
  body: { padding: 20 },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 11,
    marginBottom: 16,
  },
  contactButtonText: { color: COLORS.accent, fontWeight: "600", fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    fontSize: 15,
    color: COLORS.text,
  },
  messageInput: { minHeight: 80, textAlignVertical: "top" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: COLORS.faintText,
    marginBottom: 8,
    marginTop: 6,
  },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  templateChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  templateChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  templateChipText: { fontSize: 13, color: COLORS.subtext, fontWeight: "600" },
  templateChipTextActive: { color: "#fff" },
});
