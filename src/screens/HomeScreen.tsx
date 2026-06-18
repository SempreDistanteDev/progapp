import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Platform
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLists, createList, deleteList } from "../services/sqlite";
import { syncListToCloud } from "../services/syncService";
import { RootStackParamList } from "../navigation/types";
import { Feather } from "@expo/vector-icons";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

interface ShoppingListLocal {
    id: number;
    nome: string;
    createdAt: string;
    cloudId: string | null;
    itemCount: number;
    totalVal: number;
}

export default function HomeScreen() {
    const navigation = useNavigation<NavigationProp>();
    const isFocused = useIsFocused();

    const [lists, setLists] = useState<ShoppingListLocal[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [syncingListId, setSyncingListId] = useState<number | null>(null);
    const [userName, setUserName] = useState("Carregando...");

    useEffect(() => {
        const fetchUserName = async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            // 1. Carregar do cache local imediatamente
            try {
                const cachedName = await AsyncStorage.getItem(`user_name_${currentUser.uid}`);
                if (cachedName) {
                    setUserName(cachedName);
                } else {
                    setUserName(currentUser.displayName || currentUser.email?.split("@")[0] || "Usuário");
                }
            } catch (cacheErr) {
                console.log("Erro ao carregar cache do nome do usuário:", cacheErr);
            }

            // 2. Tentar buscar da rede (Firestore) e atualizar o cache
            try {
                const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                if (userDoc.exists()) {
                    const nome = userDoc.data().nome;
                    if (nome) {
                        setUserName(nome);
                        await AsyncStorage.setItem(`user_name_${currentUser.uid}`, nome);
                    }
                }
            } catch (error) {
                console.warn("Erro ao carregar nome via rede (usando cache local):", error);
            }
        };
        fetchUserName();
    }, []);

    const loadLists = async () => {
        try {
            setLoading(true);
            const data = await getLists();
            setLists(data as ShoppingListLocal[]);
        } catch (error) {
            console.error("Erro ao carregar listas:", error);
            Alert.alert("Erro", "Não foi possível carregar as listas de compras.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isFocused) {
            loadLists();
        }
    }, [isFocused]);

    const handleCreateList = async () => {
        if (!newListName.trim()) {
            Alert.alert("Atenção", "Insira um nome para a lista!");
            return;
        }

        try {
            const newListId = await createList(newListName.trim());
            setNewListName("");
            setModalVisible(false);
            // Navigate to ListScreen (Lista) passing the newly created listId
            navigation.navigate("Lista", { listId: newListId });
        } catch (error) {
            console.error("Erro ao criar lista:", error);
            Alert.alert("Erro", "Não foi possível criar a lista.");
        }
    };

    const handleDeleteList = async (id: number, name: string) => {
        Alert.alert(
            "Excluir Lista",
            `Tem certeza que deseja excluir "${name}" e todos os seus itens do dispositivo?`,
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteList(id);
                            loadLists();
                        } catch (error) {
                            console.error("Erro ao excluir lista:", error);
                            Alert.alert("Erro", "Não foi possível excluir a lista.");
                        }
                    }
                }
            ]
        );
    };

    const handleSyncList = async (id: number) => {
        try {
            setSyncingListId(id);
            await syncListToCloud(id);
            Alert.alert("Sucesso", "Lista sincronizada com a nuvem!");
            loadLists(); // Refresh sync status icons
        } catch (error: any) {
            console.error("Erro ao sincronizar:", error);
            Alert.alert("Erro de Sincronização", error.message || "Erro desconhecido.");
        } finally {
            setSyncingListId(null);
        }
    };

    const performLogout = async () => {
        try {
            await signOut(auth);
            navigation.replace("Login");
        } catch (error) {
            console.error("Erro ao deslogar:", error);
            if (Platform.OS === 'web') {
                alert("Não foi possível sair.");
            } else {
                Alert.alert("Erro", "Não foi possível sair.");
            }
        }
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            const confirmLogout = window.confirm("Deseja realmente sair da sua conta?");
            if (confirmLogout) {
                performLogout();
            }
        } else {
            Alert.alert(
                "Sair",
                "Deseja realmente sair da sua conta?",
                [
                    { text: "Cancelar", style: "cancel" },
                    {
                        text: "Sair",
                        style: "destructive",
                        onPress: performLogout
                    }
                ]
            );
        }
    };

    const formatCurrency = (val: number) => {
        return `R$ ${val.toFixed(2).replace(".", ",")}`;
    };

    const renderItem = ({ item }: { item: ShoppingListLocal }) => {
        const isSyncing = syncingListId === item.id;
        
        return (
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.cardContent}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate("Lista", { listId: item.id })}
                >
                    <View style={styles.cardHeader}>
                        <View style={styles.listIconBg}>
                            <Feather name="shopping-bag" size={20} color="#2D7A4F" />
                        </View>
                        <View style={styles.titleContainer}>
                            <Text style={styles.listTitle}>{item.nome}</Text>
                            <Text style={styles.listDate}>
                                {item.itemCount} {item.itemCount === 1 ? "item" : "itens"} · {item.createdAt}
                            </Text>
                        </View>
                    </View>
                    
                    <View style={styles.cardFooter}>
                        <Text style={styles.totalLabel}>Total Estimado</Text>
                        <Text style={styles.totalValue}>{formatCurrency(item.totalVal)}</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.syncBtn]}
                        onPress={() => handleSyncList(item.id)}
                        disabled={isSyncing}
                        activeOpacity={0.7}
                    >
                        {isSyncing ? (
                            <ActivityIndicator size="small" color="#2D7A4F" />
                        ) : (
                            <Feather
                                name={item.cloudId ? "cloud" : "cloud-lightning"}
                                size={18}
                                color={item.cloudId ? "#2D7A4F" : "#8FAF97"}
                            />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={() => handleDeleteList(item.id, item.nome)}
                        activeOpacity={0.7}
                    >
                        <Feather name="trash-2" size={18} color="#FF6347" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcome}>Olá!</Text>
                    <Text style={styles.email}>{userName}</Text>
                </View>
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
                    <Feather name="log-out" size={20} color="#74C69D" />
                </TouchableOpacity>
            </View>

            {/* List Body */}
            <View style={styles.body}>
                <Text style={styles.sectionTitle}>Minhas Listas</Text>

                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#2D7A4F" />
                    </View>
                ) : lists.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <View style={styles.emptyIconBg}>
                            <Feather name="shopping-cart" size={48} color="#2D7A4F" />
                        </View>
                        <Text style={styles.emptyTitle}>Nenhuma lista ainda</Text>
                        <Text style={styles.emptySubtitle}>
                            Toque no botão de mais para criar sua primeira lista de compras local
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyCreateBtn}
                            onPress={() => setModalVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Feather name="plus" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyCreateBtnText}>Criar Lista</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={lists}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listScroll}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>

            {/* FAB Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.85}
            >
                <Feather name="plus" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Create List Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Nova Lista</Text>
                        <Text style={styles.modalSubtitle}>Defina o nome da sua lista de compras</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Ex: Supermercado Mensal"
                            placeholderTextColor="#8FAF97"
                            value={newListName}
                            onChangeText={setNewListName}
                            maxLength={40}
                            autoFocus
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalCancelBtn]}
                                onPress={() => {
                                    setNewListName("");
                                    setModalVisible(false);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalConfirmBtn]}
                                onPress={handleCreateList}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalConfirmText}>Criar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5FBF7", // Mint-tinted light background
    },
    header: {
        backgroundColor: "#1B4332", // Deep forest green
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'android' ? 48 : 20,
        paddingBottom: 24,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
    welcome: {
        fontSize: 12,
        color: "#74C69D",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    email: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginTop: 2,
    },
    logoutBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.05)",
    },
    body: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#1A2E1F",
        marginBottom: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    listScroll: {
        paddingBottom: 100, // Space for FAB
        gap: 12,
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#D8F3DC",
        flexDirection: "row",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    listIconBg: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "#E8F5EC",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    titleContainer: {
        flex: 1,
    },
    listTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#1A2E1F",
    },
    listDate: {
        fontSize: 12,
        color: "#5A7A65",
        marginTop: 2,
    },
    cardFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopWidth: 1,
        borderTopColor: "#F0FBF4",
        paddingTop: 12,
    },
    totalLabel: {
        fontSize: 12,
        color: "#8FAF97",
    },
    totalValue: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#2D7A4F",
    },
    actionsContainer: {
        borderLeftWidth: 1,
        borderLeftColor: "#E8F5EC",
        width: 56,
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        paddingVertical: 12,
    },
    actionBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    syncBtn: {
        backgroundColor: "#F0FBF4",
    },
    deleteBtn: {
        backgroundColor: "#FFF3F0",
    },
    fab: {
        position: "absolute",
        right: 24,
        bottom: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#2D7A4F",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#2D7A4F",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    emptyContainer: {
        flex: 0.8,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        paddingHorizontal: 16,
    },
    emptyIconBg: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#E8F5EC",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#1A2E1F",
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: "#5A7A65",
        textAlign: "center",
        lineHeight: 20,
        marginBottom: 24,
    },
    emptyCreateBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#2D7A4F",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 14,
        shadowColor: "#2D7A4F",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    emptyCreateBtnText: {
        color: "#FFFFFF",
        fontWeight: "bold",
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(13, 31, 22, 0.6)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    modalContent: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        borderRadius: 28,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#1A2E1F",
        textAlign: "center",
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 13,
        color: "#5A7A65",
        textAlign: "center",
        marginBottom: 20,
    },
    modalInput: {
        height: 50,
        borderWidth: 1.5,
        borderColor: "#C8E3DF",
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 15,
        color: "#1A2E1F",
        backgroundColor: "#F5FAFA",
        marginBottom: 20,
    },
    modalButtons: {
        flexDirection: "row",
        gap: 12,
    },
    modalBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    modalCancelBtn: {
        backgroundColor: "#F0F9F3",
        borderWidth: 1,
        borderColor: "#C8E3DF",
    },
    modalCancelText: {
        color: "#2D7A4F",
        fontWeight: "bold",
    },
    modalConfirmBtn: {
        backgroundColor: "#2D7A4F",
    },
    modalConfirmText: {
        color: "#FFFFFF",
        fontWeight: "bold",
    },
});