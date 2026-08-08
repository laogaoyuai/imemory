import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../src/components/screen';
import { useAuthStore } from '../src/state/auth-store';
import { colors, radius } from '../src/theme';

export default function AuthScreen() {
  const [registering, setRegistering] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);

  const submit = async () => {
    setSubmitting(true);
    try {
      if (registering) await register(phone, password);
      else await login(phone, password);
      router.replace('/');
    } catch (error) {
      Alert.alert(registering ? '注册失败' : '登录失败', error instanceof Error ? error.message : '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ATLAS CONTENT</Text>
        <Text style={styles.title}>{registering ? '创建账号' : '欢迎回来'}</Text>
        <Text style={styles.subtitle}>使用手机号和密码{registering ? '注册' : '登录'}，暂不需要验证码</Text>
        <TextInput keyboardType="phone-pad" maxLength={20} onChangeText={setPhone} placeholder="手机号" placeholderTextColor={colors.muted} style={styles.input} value={phone} />
        <TextInput autoCapitalize="none" maxLength={6} onChangeText={setPassword} placeholder="密码（6位字母或数字）" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} value={password} />
        <Pressable disabled={submitting} onPress={() => void submit()} style={[styles.submit, submitting && styles.disabled]}><Text style={styles.submitText}>{submitting ? '处理中…' : registering ? '注册并登录' : '登录'}</Text></Pressable>
        <Pressable onPress={() => setRegistering((value) => !value)} style={styles.switch}><Text style={styles.switchText}>{registering ? '已有账号？去登录' : '还没有账号？去注册'}</Text></Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center', padding: 22 },
  card: { padding: 22, borderRadius: radius.large, backgroundColor: colors.card },
  eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 10 },
  subtitle: { color: colors.secondary, fontSize: 13, lineHeight: 21, marginTop: 6, marginBottom: 23 },
  input: { color: colors.ink, fontSize: 15, minHeight: 50, paddingHorizontal: 14, borderRadius: radius.medium, backgroundColor: colors.paper, marginBottom: 11 },
  submit: { alignItems: 'center', paddingVertical: 13, borderRadius: radius.medium, backgroundColor: colors.accent, marginTop: 5 },
  disabled: { opacity: 0.55 },
  submitText: { color: colors.card, fontSize: 15, fontWeight: '800' },
  switch: { alignItems: 'center', paddingTop: 18 },
  switchText: { color: colors.sage, fontSize: 13, fontWeight: '700' },
});
