import React, { useState } from 'react';
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from "../services/firebase";
import { saveUser } from '../services/userService';
import { User } from '../types/User';
import { RootStackParamList } from "../navigation/types";
import { Feather } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Cadastro">;

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  const saveUserFunction = async () => {
    if (!nome.trim() || !email.trim() || !senha.trim() || !confirmarSenha.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos!");
      return;
    }

    if (senha !== confirmarSenha) {
      Alert.alert("Atenção", "As senhas não coincidem!");
      return;
    }

    if (senha.length < 6) {
      Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Atenção", "Informe um email válido");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        senha
      );

      const newUser: User = {
        uid: userCredential.user.uid,
        nome: nome.trim(),
        email: email.trim(),
        createdAt: new Date(),
      };

      await saveUser(newUser);
      setLoading(false);
      Alert.alert("Sucesso", "Conta criada com sucesso!", [
        { text: "OK", onPress: () => navigation.navigate("Login") }
      ]);
    } catch (error: any) {
      setLoading(false);
      console.error("Erro no cadastro:", error);
      let errorMsg = "Erro ao criar conta. Tente novamente.";
      switch (error.code) {
        case "auth/email-already-in-use":
          errorMsg = "Este e-mail já está cadastrado.";
          break;
        case "auth/invalid-email":
          errorMsg = "Formato de e-mail inválido.";
          break;
        case "auth/weak-password":
          errorMsg = "A senha é muito fraca. Digite no mínimo 6 caracteres.";
          break;
      }
      Alert.alert("Erro", errorMsg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate("Login")}
          >
            <Feather name="arrow-left" size={20} color="#74C69D" />
            <Text style={styles.backButtonText}>Voltar para o Login</Text>
          </TouchableOpacity>
          <View style={styles.logoBg}>
            <Image
              source={require("../img/red-panda-ai-seeklogo.png")}
              style={styles.logo}
            />
          </View>
          <Text style={styles.brandTitle}>
            Criar <Text style={styles.brandAccent}>Conta</Text>
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome Completo</Text>
              <TextInput
                style={styles.input}
                placeholder="Seu nome completo"
                placeholderTextColor="#8FAF97"
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />
            </View>

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
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!showSenha}
                />
                <TouchableOpacity
                  onPress={() => setShowSenha(!showSenha)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={showSenha ? "eye" : "eye-off"}
                    size={18}
                    color="#5A7A65"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirmar Senha</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••"
                  placeholderTextColor="#8FAF97"
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry={!showConfirmarSenha}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmarSenha(!showConfirmarSenha)}
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={showConfirmarSenha ? "eye" : "eye-off"}
                    size={18}
                    color="#5A7A65"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={saveUserFunction}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Cadastrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1F16', // Sleek dark forest green base
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  topHeader: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#74C69D',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 10,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: '#74C69D',
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
});