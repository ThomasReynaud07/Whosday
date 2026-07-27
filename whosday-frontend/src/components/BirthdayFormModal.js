import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { COLORS, RADIUS, SHADOWS } from "../theme";
import { useI18n, t, getTemplates } from "../i18n";
import { api } from "../api";
import { pickImage, uploadImage } from "../media";
import { personalizeMessage } from "../messageVars";
import Avatar from "./Avatar";
import DateField from "./DateField";
import TimeField from "./TimeField";
import GifPickerModal from "./GifPickerModal";

function SectionLabel({ icon, children }) {
  return (
    <View style={styles.sectionRow}>
      <Feather name={icon} size={13} color={COLORS.accent} />
      <Text style={styles.sectionLabel}>{children}</Text>
    </View>
  );
}

const EMPTY_FORM = {
  name: "",
  phoneNumber: "",
  month: null,
  day: null,
  birthYear: "",
  sendTime: "09:00",
  message: "",
  photoUrl: null,
  mediaUrl: null,
  mediaType: null,
  mediaPreviewUrl: null,
};

export default function BirthdayFormModal({ visible, initialValues, onClose, onSubmit, onDelete }) {
  const { lang } = useI18n();
  const [form, setForm] = useState(EMPTY_FORM);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [gifPickerVisible, setGifPickerVisible] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [tone, setTone] = useState("warm");
  const [aiPrompt, setAiPrompt] = useState("");
  const isEditing = Boolean(initialValues);
  const templates = getTemplates();

  const TONES = [
    { key: "warm", label: t("form.toneWarm") },
    { key: "fun", label: t("form.toneFun") },
    { key: "short", label: t("form.toneShort") },
    { key: "classic", label: t("form.toneClassic") },
  ];

  async function generateWithAI() {
    setAiBusy(true);
    try {
      const message = await api.generateMessage({
        name: form.name,
        lang,
        tone,
        prompt: aiPrompt.trim() || undefined,
      });
      setForm((f) => ({ ...f, message }));
    } catch (err) {
      const detail =
        err?.response?.status
          ? `${err.response.status} ${JSON.stringify(err.response.data)}`
          : err?.message || String(err);
      console.log("[ai] generate error:", detail);
      Alert.alert(t("common.error"), `${t("form.aiError")}\n\n${detail}`);
    } finally {
      setAiBusy(false);
    }
  }

  async function changeContactPhoto() {
    try {
      const asset = await pickImage({ square: true });
      if (!asset) return;
      setMediaBusy(true);
      const uid = await api.currentUserId();
      const url = await uploadImage(asset, `${uid}/contacts/${Date.now()}.jpg`);
      setForm((f) => ({ ...f, photoUrl: url }));
    } catch {
      Alert.alert(t("common.error"), t("media.uploadError"));
    } finally {
      setMediaBusy(false);
    }
  }

  async function addMessageImage() {
    try {
      const asset = await pickImage();
      if (!asset) return;
      setMediaBusy(true);
      const uid = await api.currentUserId();
      const url = await uploadImage(asset, `${uid}/messages/${Date.now()}.jpg`);
      setForm((f) => ({ ...f, mediaUrl: url, mediaType: "image", mediaPreviewUrl: null }));
    } catch {
      Alert.alert(t("common.error"), t("media.uploadError"));
    } finally {
      setMediaBusy(false);
    }
  }

  function onGifSelected({ gif, preview }) {
    setForm((f) => ({ ...f, mediaUrl: gif, mediaType: "gif", mediaPreviewUrl: preview }));
    setGifPickerVisible(false);
  }

  function clearMedia() {
    setForm((f) => ({ ...f, mediaUrl: null, mediaType: null, mediaPreviewUrl: null }));
  }


  useEffect(() => {
    if (visible) {
      setTone("warm");
      setAiPrompt("");
      setForm(
        initialValues
          ? {
              name: initialValues.name,
              phoneNumber: initialValues.phoneNumber,
              month: initialValues.month,
              day: initialValues.day,
              birthYear: initialValues.birthYear ? String(initialValues.birthYear) : "",
              sendTime: initialValues.sendTime || "09:00",
              message: initialValues.message,
              photoUrl: initialValues.photoUrl ?? null,
              mediaUrl: initialValues.mediaUrl ?? null,
              mediaType: initialValues.mediaType ?? null,
              mediaPreviewUrl: initialValues.mediaPreviewUrl ?? null,
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
        // expo-contacts returns month 0-indexed (Jan = 0); the app uses 1-12.
        month: contact.birthday ? contact.birthday.month + 1 : f.month,
        day: contact.birthday ? contact.birthday.day : f.day,
      }));
    } catch (err) {
      Alert.alert(t("form.contactError"), err.message);
    }
  }

  const { name, phoneNumber, month, day, birthYear, sendTime, message, photoUrl, mediaUrl, mediaType, mediaPreviewUrl } = form;
  const isValid = Boolean(name && phoneNumber && month && day && message);

  function handleSubmit() {
    if (!isValid) {
      Alert.alert(t("form.missingTitle"), t("form.missingMsg"));
      return;
    }
    let parsedYear = null;
    if (birthYear.trim()) {
      const y = Number(birthYear);
      const thisYear = new Date().getFullYear();
      if (!Number.isInteger(y) || y < 1900 || y > thisYear) {
        Alert.alert(t("form.invalidYearTitle"), t("form.invalidYearMsg", { year: thisYear }));
        return;
      }
      parsedYear = y;
    }
    onSubmit({ name, phoneNumber, month, day, birthYear: parsedYear, sendTime, message, photoUrl, mediaUrl, mediaType, mediaPreviewUrl });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.cancel}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? t("form.editTitle") : t("form.newTitle")}</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!isValid}
            activeOpacity={0.85}
            style={[styles.saveButton, !isValid && styles.saveButtonDisabled]}
          >
            <Text style={[styles.saveText, !isValid && styles.saveTextDisabled]}>OK</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={8}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar preview (tap to set a photo) */}
            <View style={styles.preview}>
              <TouchableOpacity onPress={changeContactPhoto} activeOpacity={0.8} style={styles.avatarWrap}>
                <Avatar name={name || "?"} size={84} uri={photoUrl} />
                <View style={styles.cameraBadge}>
                  {mediaBusy && !mediaUrl ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather name="camera" size={14} color="#fff" />
                  )}
                </View>
              </TouchableOpacity>
              <Text style={styles.previewName}>{name || t("form.previewNew")}</Text>
            </View>

            <TouchableOpacity style={styles.contactButton} activeOpacity={0.8} onPress={pickFromContacts}>
              <Feather name="user-plus" size={16} color={COLORS.accent} />
              <Text style={styles.contactButtonText}>{t("form.fromContacts")}</Text>
            </TouchableOpacity>

            {/* Infos */}
            <SectionLabel icon="user">{t("form.contact")}</SectionLabel>
            <View style={styles.inputRow}>
              <Feather name="user" size={17} color={COLORS.faintText} />
              <TextInput
                style={styles.input}
                placeholder={t("form.name")}
                placeholderTextColor={COLORS.faintText}
                value={form.name}
                onChangeText={(name) => setForm((f) => ({ ...f, name }))}
              />
            </View>
            <View style={styles.inputRow}>
              <Feather name="phone" size={17} color={COLORS.faintText} />
              <TextInput
                style={styles.input}
                placeholder={t("form.phone")}
                placeholderTextColor={COLORS.faintText}
                keyboardType="phone-pad"
                value={form.phoneNumber}
                onChangeText={(phoneNumber) => setForm((f) => ({ ...f, phoneNumber }))}
              />
            </View>

            {/* Date */}
            <SectionLabel icon="gift">{t("form.birthdate")}</SectionLabel>
            <DateField
              month={form.month}
              day={form.day}
              onChange={({ month, day }) => setForm((f) => ({ ...f, month, day }))}
            />
            <View style={styles.inputRow}>
              <Feather name="calendar" size={17} color={COLORS.faintText} />
              <TextInput
                style={styles.input}
                placeholder={t("form.yearOptional")}
                placeholderTextColor={COLORS.faintText}
                keyboardType="number-pad"
                maxLength={4}
                value={form.birthYear}
                onChangeText={(birthYear) =>
                  setForm((f) => ({ ...f, birthYear: birthYear.replace(/[^\d]/g, "") }))
                }
              />
            </View>

            {/* Send time */}
            <SectionLabel icon="clock">{t("form.sendTime")}</SectionLabel>
            <TimeField value={form.sendTime} onChange={(sendTime) => setForm((f) => ({ ...f, sendTime }))} />
            <Text style={styles.hint}>{t("form.sendTimeHint")}</Text>

            {/* Message */}
            <SectionLabel icon="message-circle">{t("form.message")}</SectionLabel>

            {/* AI composer */}
            <View style={styles.aiCard}>
              <View style={styles.aiCardHead}>
                <View style={styles.aiCardTitleWrap}>
                  <Feather name="zap" size={14} color={COLORS.accent} />
                  <Text style={styles.aiCardTitle}>{t("form.aiCompose")}</Text>
                </View>
              </View>

              <View style={styles.toneRow}>
                {TONES.map((tn) => (
                  <TouchableOpacity
                    key={tn.key}
                    style={[styles.chip, tone === tn.key && styles.chipActive]}
                    onPress={() => setTone(tn.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, tone === tn.key && styles.chipTextActive]}>{tn.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.promptInput}
                placeholder={t("form.aiPromptPlaceholder")}
                placeholderTextColor={COLORS.faintText}
                value={aiPrompt}
                onChangeText={setAiPrompt}
                multiline
              />

              <TouchableOpacity
                style={[styles.aiButton, aiBusy && styles.aiButtonBusy]}
                activeOpacity={0.85}
                onPress={generateWithAI}
                disabled={aiBusy}
              >
                {aiBusy ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather name="zap" size={15} color="#fff" />
                )}
                <Text style={styles.aiButtonText}>
                  {aiBusy
                    ? t("form.aiGenerating")
                    : form.message.trim().length > 0
                      ? t("form.aiRegenerate")
                      : t("form.aiGenerate")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick templates */}
            <Text style={styles.orLabel}>{t("form.templatesLabel")}</Text>
            <View style={styles.templateRow}>
              {templates.map((tpl) => (
                <TouchableOpacity
                  key={tpl.label}
                  style={[styles.chip, form.message === tpl.text && styles.chipActive]}
                  onPress={() => setForm((f) => ({ ...f, message: tpl.text }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, form.message === tpl.text && styles.chipTextActive]}>
                    {tpl.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.messageInput}
              placeholder={t("form.messagePlaceholder")}
              placeholderTextColor={COLORS.faintText}
              multiline
              value={form.message}
              onChangeText={(message) => setForm((f) => ({ ...f, message }))}
            />
            <Text style={styles.hint}>{t("form.varsHint")}</Text>

            {form.message.trim().length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 18, marginBottom: 8 }]}>{t("form.preview")}</Text>
                <View style={styles.bubble}>
                  <Text style={styles.bubbleText}>{personalizeMessage(form.message, form.name)}</Text>
                </View>
              </>
            )}

            {/* Message media: photo OR gif (sent with the WhatsApp message) */}
            <SectionLabel icon="image">{t("form.mediaLabel")}</SectionLabel>
            {mediaUrl ? (
              <View style={styles.mediaPreview}>
                <Image
                  source={{ uri: mediaType === "gif" ? mediaPreviewUrl : mediaUrl }}
                  style={styles.mediaImage}
                />
                {mediaType === "gif" && (
                  <View style={styles.gifBadge}>
                    <Text style={styles.gifBadgeText}>GIF</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.mediaRemove} onPress={clearMedia}>
                  <Feather name="x" size={14} color="#fff" />
                  <Text style={styles.mediaRemoveText}>{t("form.removeImage")}</Text>
                </TouchableOpacity>
              </View>
            ) : mediaBusy ? (
              <View style={styles.mediaTile}>
                <ActivityIndicator color={COLORS.accent} />
              </View>
            ) : (
              <View style={styles.mediaRow}>
                <TouchableOpacity style={styles.mediaTile} activeOpacity={0.85} onPress={addMessageImage}>
                  <View style={styles.mediaTileIcon}>
                    <Feather name="image" size={20} color={COLORS.accent} />
                  </View>
                  <Text style={styles.mediaTileText}>{t("form.addPhoto")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaTile} activeOpacity={0.85} onPress={() => setGifPickerVisible(true)}>
                  <View style={styles.mediaTileIcon}>
                    <Feather name="film" size={20} color={COLORS.accent} />
                  </View>
                  <Text style={styles.mediaTileText}>{t("form.addGif")}</Text>
                </TouchableOpacity>
              </View>
            )}

            {isEditing && onDelete && (
              <TouchableOpacity
                style={styles.deleteButton}
                activeOpacity={0.8}
                onPress={() => onDelete(initialValues)}
              >
                <Feather name="trash-2" size={16} color={COLORS.danger} />
                <Text style={styles.deleteText}>{t("form.deleteBtn")}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <GifPickerModal
          visible={gifPickerVisible}
          onClose={() => setGifPickerVisible(false)}
          onSelect={onGifSelected}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.screenBg },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: COLORS.surface,
  },
  cancel: { fontSize: 15, color: COLORS.subtext, fontWeight: "500" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  saveButton: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
    ...SHADOWS.accent,
  },
  saveButtonDisabled: { backgroundColor: COLORS.segmentBg, shadowOpacity: 0, elevation: 0 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  saveTextDisabled: { color: COLORS.faintText },
  body: { padding: 20, paddingBottom: 44 },
  preview: { alignItems: "center", marginBottom: 18 },
  avatarWrap: { position: "relative" },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.screenBg,
  },
  previewName: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginTop: 10 },
  addImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    paddingVertical: 16,
  },
  addImageText: { color: COLORS.accent, fontWeight: "700", fontSize: 14 },
  mediaRow: { flexDirection: "row", gap: 12 },
  mediaTile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.accentSofter,
    borderWidth: 1,
    borderColor: COLORS.accentSoft,
    borderRadius: RADIUS.lg,
    paddingVertical: 22,
  },
  mediaTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTileText: { color: COLORS.accent, fontWeight: "800", fontSize: 14 },
  gifBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gifBadgeText: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  aiCard: {
    backgroundColor: COLORS.accentSofter,
    borderWidth: 1,
    borderColor: COLORS.accentSoft,
    borderRadius: RADIUS.lg,
    padding: 14,
  },
  aiCardHead: { marginBottom: 10 },
  aiCardTitleWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  aiCardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.accentDark },
  toneRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  promptInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 52,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    ...SHADOWS.accent,
  },
  aiButtonBusy: { opacity: 0.8 },
  aiButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  orLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.faintText,
    marginTop: 18,
    marginBottom: 10,
  },
  bubble: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    backgroundColor: "#D9FDD3",
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleText: { fontSize: 15, color: "#0B1F12", lineHeight: 20 },
  mediaPreview: { position: "relative", borderRadius: RADIUS.md, overflow: "hidden" },
  mediaImage: { width: "100%", height: 180, borderRadius: RADIUS.md, backgroundColor: COLORS.segmentBg },
  mediaRemove: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  mediaRemoveText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.accentSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    marginBottom: 8,
  },
  contactButtonText: { color: COLORS.accent, fontWeight: "700", fontSize: 14 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 24, marginBottom: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: COLORS.subtext,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: COLORS.text },
  hint: { fontSize: 12.5, color: COLORS.subtext, marginTop: 8, lineHeight: 18 },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 13, color: COLORS.subtext, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  messageInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 96,
    textAlignVertical: "top",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 15,
    marginTop: 28,
  },
  deleteText: { color: COLORS.danger, fontWeight: "700", fontSize: 15 },
});
