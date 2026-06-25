import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { auth } from "../services/firebase";
import { RootStackParamList } from "../navigation/types";
import { Feather } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        navigation.replace("Home");
      }
    });
    return unsubscribe;
  }, [navigation]);


  const handleForgotPw = () => {
    if (!email.trim()) {
      Alert.alert(
        "Recuperação de Senha",
        "Por favor, insira o seu e-mail no campo correspondente antes de clicar em recuperar senha."
      );
      return;
    }
    setLoading(true);
    sendPasswordResetEmail(auth, email.trim())
      .then(() => {
        setLoading(false);
        Alert.alert(
          "E-mail Enviado",
          `Um link para redefinir sua senha foi enviado para: ${email.trim()}. Verifique sua caixa de entrada e spam.`
        );
      })
      .catch((error: any) => {
        setLoading(false);
        console.error("Erro ao resetar senha:", error);
        let errorMsg = "Ocorreu um erro ao tentar enviar o e-mail de recuperação. Tente novamente.";
        if (error.code === "auth/invalid-email") {
          errorMsg = "Formato de e-mail inválido.";
        } else if (error.code === "auth/user-not-found") {
          errorMsg = "Nenhum usuário cadastrado com este e-mail.";
        }
        Alert.alert("Erro", errorMsg);
      });
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos!");
      return;
    }
    setLoading(true);
    signInWithEmailAndPassword(auth, email.trim(), password)
      .then((userCredential) => {
        setLoading(false);
        console.log("Usuário logado:", userCredential.user.email);
        navigation.replace("Home");
      })
      .catch((error) => {
        setLoading(false);
        console.error("Erro no login:", error);
        let errorMsg = "Erro ao fazer login. Verifique seus dados.";
        if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
          errorMsg = "E-mail ou senha incorretos.";
        } else if (error.code === "auth/invalid-email") {
          errorMsg = "Formato de e-mail inválido.";
        }
        Alert.alert("Erro", errorMsg);
      });
  };

  return (
    <KeyboardAvoidingView
    style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topHeader}>
        <View style={styles.logoBg}>
          <Image
            source={require("../img/red-panda-ai-seeklogo.png")}
            style={styles.logo}
          />
        </View>
        <Text style={styles.brandTitle}>
          Pandas<Text style={styles.brandAccent}>Vision</Text>
        </Text>
        <Text style={styles.brandSubtitle}>LISTAINTELIGENTE</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Bem-vindo!</Text>
        <Text style={styles.subtitle}>Entre para gerenciar suas compras</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor="#8FAF97"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#8FAF97"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <Feather
                  name={showPassword ? "eye" : "eye-off"}
                  size={18}
                  color="#5A7A65"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPw}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotText}>Esqueceu a senha?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou continue com</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Cadastro")}>
              <Text style={styles.registerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1F16', // Sleek dark forest green base
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  topHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  logo: {
    width: 65,
    height: 65,
    borderRadius: 12,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: '#74C69D',
  },
  brandSubtitle: {
    fontSize: 11,
    color: '#74C69D',
    letterSpacing: 3,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#F5FBF7', // Light soft mint-tinted white
    borderRadius: 36,
    paddingVertical: 32,
    paddingHorizontal: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A2E1F',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#5A7A65',
    textAlign: 'center',
    marginBottom: 24,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2D7A4F',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1A2E1F',
    backgroundColor: '#E8F5EC',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EC',
    borderRadius: 14,
    height: 48,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1A2E1F',
    height: '100%',
  },
  eyeBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    height: '100%',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
  },
  forgotText: {
    color: '#2D7A4F',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    height: 52,
    backgroundColor: '#2D7A4F',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#2D7A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D8F3DC',
  },
  dividerText: {
    fontSize: 11,
    color: '#8FAF97',
    paddingHorizontal: 12,
  },
  googleButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D8F3DC',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleButtonText: {
    color: '#1A2E1F',
    fontSize: 14,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  registerText: {
    color: '#5A7A65',
    fontSize: 13,
  },
  registerLink: {
    color: '#2D7A4F',
    fontWeight: 'bold',
    fontSize: 13,
  },
});