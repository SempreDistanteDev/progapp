import React, { useState, useEffect, useRef } from 'react';
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    FlatList,
    Platform,
    Alert,
    ActivityIndicator,
    Modal,
    SafeAreaView
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import MlkitOcr from 'rn-mlkit-ocr';
import { Feather } from "@expo/vector-icons";

import { getListById, getItemsByList, addItemToList, updateItemInList, deleteItemFromList } from '../services/sqlite';
import { syncListToCloud } from '../services/syncService';
import { ShoppingItem } from '../types/ShoppingItem';
import { RootStackParamList } from '../navigation/types';

// Mock product database for OCR simulation fallback (simulates AI recognition)
const PRODUCTS = [
    { name: "Leite Integral Itambé 1L", price: 4.99 },
    { name: "Pão de Forma Integral Seven Boys", price: 8.50 },
    { name: "Arroz Branco Tio João 5kg", price: 22.90 },
    { name: "Feijão Carioca Camil 1kg", price: 9.75 },
    { name: "Frango Inteiro Resfriado", price: 28.90 },
    { name: "Óleo de Soja Liza 900ml", price: 7.49 },
    { name: "Macarrão Espaguete Barilla 500g", price: 6.29 },
    { name: "Molho de Tomate Pomarola 340g", price: 3.99 },
    { name: "Queijo Mussarela Fatiado 500g", price: 19.90 },
    { name: "Iogurte Natural Nestlé 170g", price: 2.89 },
    { name: "Sabão em Pó OMO 1kg", price: 14.90 },
    { name: "Shampoo Pantene Hidratação 400ml", price: 18.90 },
    { name: "Desodorante Rexona Men 150ml", price: 12.50 },
    { name: "Café Pilão Extra Forte 500g", price: 16.90 },
    { name: "Açúcar Refinado União 1kg", price: 4.89 },
    { name: "Biscoito Oreo 130g", price: 5.49 },
    { name: "Refrigerante Coca-Cola 2L", price: 9.99 },
    { name: "Detergente Ypê Neutro 500ml", price: 2.99 },
    { name: "Farinha de Trigo Dona Benta 1kg", price: 5.75 },
    { name: "Manteiga President com Sal 200g", price: 11.90 },
];

type ListScreenRouteProp = RouteProp<RootStackParamList, "Lista">;

export default function AddItemScreen() {
    const navigation = useNavigation();
    const route = useRoute<ListScreenRouteProp>();
    const { listId } = route.params;

    const cameraRef = useRef<CameraView>(null);

    // ---------------- STATE CONFIG ---------------------- //
    const [listName, setListName] = useState('');
    const [itens, setItens] = useState<ShoppingItem[]>([]);
    
    const [facing, setFacing] = useState<CameraType>('back');
    const [permission, requestPermission] = useCameraPermissions();
    
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showForm, setShowForm] = useState(false);
    
    const [editingId, setEditingId] = useState<number | null>(null);
    const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
    const [cloudId, setCloudId] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);

    // Form fields
    const [nome, setNome] = useState('');
    const [valorUnitario, setValorUnitario] = useState('');
    const [quantidade, setQuantidade] = useState('1');
    const [imagemUrl, setImagemUrl] = useState('');

    const carregarDadosDaLista = async () => {
        try {
            // Load list details
            const listInfo = await getListById(listId);
            if (listInfo) {
                setListName(listInfo.nome);
                setCloudId(listInfo.cloudId || null);
            }
            // Load items
            const dados = await getItemsByList(listId);
            setItens(dados as ShoppingItem[]);
        } catch (error) {
            console.error("Erro ao carregar dados da lista:", error);
            Alert.alert("Erro", "Não foi possível carregar os itens desta lista.");
        }
    };

    useEffect(() => {
        carregarDadosDaLista();
    }, [listId]);

    const handleSyncList = async () => {
        try {
            setSyncing(true);
            const newCloudId = await syncListToCloud(listId);
            setCloudId(newCloudId);
            Alert.alert("Sucesso", "Lista sincronizada com a nuvem!");
            carregarDadosDaLista();
        } catch (error: any) {
            console.error("Erro ao sincronizar lista:", error);
            Alert.alert("Erro de Sincronização", error.message || "Erro desconhecido.");
        } finally {
            setSyncing(false);
        }
    };

    // OCR Parser Logic
    const parseOCRResult = (ocrResult: any) => {
        let name = '';
        let price = 0;
        const lines: string[] = [];

        // Support both old array representation or new OcrResult object containing blocks
        const blocks = Array.isArray(ocrResult) ? ocrResult : (ocrResult?.blocks || []);

        if (blocks && Array.isArray(blocks)) {
            for (const block of blocks) {
                if (block.lines && Array.isArray(block.lines)) {
                    for (const line of block.lines) {
                        if (line.text) lines.push(line.text.trim());
                    }
                } else if (block.text) {
                    lines.push(block.text.trim());
                }
            }
        }

        console.log("OCR Extracted lines:", lines);

        // 1. EXTRACT PRICE
        // Heuristic A: standard format like "R$ 5,99", "120.50", "R$1,39"
        const priceRegex = /(?:R\$?\s*|\$\s*)?(\d+[\.,]\d{2})/i;
        for (const line of lines) {
            const match = line.match(priceRegex);
            if (match) {
                const parsedPrice = parseFloat(match[1].replace(',', '.'));
                if (parsedPrice > 0) {
                    price = parsedPrice;
                    break;
                }
            }
        }

        // Heuristic B: space-separated cents like "R$1 39"
        if (price === 0) {
            const spacePriceRegex = /(?:R\$?\s*|\$\s*)?(\d+)\s+(\d{2})\b/i;
            for (const line of lines) {
                const match = line.match(spacePriceRegex);
                if (match) {
                    const parsedPrice = parseFloat(`${match[1]}.${match[2]}`);
                    if (parsedPrice > 0) {
                        price = parsedPrice;
                        break;
                    }
                }
            }
        }

        // Heuristic C: split line cents where lines[i] is integer and lines[i+1] is 2-digit cents
        if (price === 0) {
            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i].trim();
                const nextLine = lines[i+1].trim();
                if (/^\d+$/.test(line) && /^\d{2}$/.test(nextLine)) {
                    const parsedPrice = parseFloat(`${line}.${nextLine}`);
                    if (parsedPrice > 0) {
                        price = parsedPrice;
                        break;
                    }
                }
            }
        }

        // 2. EXTRACT PRODUCT NAME
        // Lines containing these symbols are typical browser/URL noise
        const noiseSymbols = ["°c", "&", "?", "=", "|", "<", ">", "@", "channel="];

        const isCandidate = (line: string) => {
            const lower = line.toLowerCase().trim();
            
            // Check length
            if (lower.length <= 2) return false;
            
            // Must not be a pure number
            if (/^\d+$/.test(lower)) return false;
            
            // Must not be a price
            if (priceRegex.test(line)) return false;
            
            // Must not contain noise symbols
            if (noiseSymbols.some(sym => lower.includes(sym))) return false;
            
            // Filter alphanumeric noise codes / barcode serials: e.g. "O76963T" or "3ac4ce01"
            const cleanLine = lower.replace(/[\.,\-\/]/g, ""); // strip dots/hyphens
            const words = cleanLine.split(/\s+/);
            for (const word of words) {
                const digitCount = (word.match(/\d/g) || []).length;
                const letterCount = (word.match(/[a-zA-Z]/g) || []).length;
                if (digitCount > 0 && letterCount > 0) {
                    const isSize = /^\d+(?:ml|g|kg|l|oz|un|x)$/i.test(word);
                    if (!isSize) {
                        return false; // Alphanumeric noise / serial code
                    }
                }
            }

            // Major noise words that should cause the entire line to be discarded
            const noiseWords = [
                "oferta", "unid", "unidade", "compartilhar", "salvar", "acessar", 
                "imagem", "imagens", "direitos", "autorais", "saiba", "mais", 
                "visual", "super", "perfis", "datacaixa", "datacabxa", "google", 
                "pesquisa", "buscar", "pesquisar", "lote", "validade", "código", 
                "barras", "ean", "total", "subtotal", "site", "web", "internet", 
                "http", "https", "www", "canal", "channel", "ofertas", "etiqueta", 
                "etiquetas", "porta", "perfil", "gôndolas", "gôndola", "sujeitas", 
                "sujeitasa", "autorais", "medida", "litro", "litros", "compartilhar",
                "salvar", "acessar", "acessar >", "<compartilhar", "compartilhar"
            ];
            
            const wordsList = lower.split(/[\s\|\-\,\.\:\!\?\/]+/);
            const hasNoiseWord = wordsList.some(w => noiseWords.includes(w));
            if (hasNoiseWord) return false;

            return true;
        };

        const candidates: { text: string; index: number }[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isCandidate(line)) {
                candidates.push({ text: line.trim(), index: i });
            }
        }

        console.log("OCR Candidate lines:", candidates.map(c => c.text));

        // Group adjacent candidates to form full names
        if (candidates.length > 0) {
            let mergedName = candidates[0].text;
            let lastIndex = candidates[0].index;
            
            for (let k = 1; k < candidates.length; k++) {
                // If the next candidate is adjacent or separated by at most 1 element
                if (candidates[k].index - lastIndex <= 2) {
                    mergedName += " " + candidates[k].text;
                    lastIndex = candidates[k].index;
                } else {
                    break;
                }
            }
            name = mergedName;
        }

        // Clean up spaces
        name = name.replace(/\s+/g, " ").trim();

        // Fallback: If no candidate name was identified, use the first non-numeric line
        if (!name) {
            for (const line of lines) {
                if (line.length > 2 && !/^\d+$/.test(line) && !priceRegex.test(line)) {
                    name = line;
                    break;
                }
            }
        }

        return {
            nome: name || "Produto Reconhecido",
            valorUnitario: price || 0
        };
    };

    // Capture and OCR integration
    const handleTirarFoto = async () => {
        if (cameraRef.current) {
            try {
                const options = { quality: 0.6, skipProcessing: false };
                const foto = await cameraRef.current.takePictureAsync(options);
                
                if (foto && foto.uri) {
                    setImagemUrl(foto.uri);
                    setIsCameraOpen(false);
                    setIsAnalyzing(true);

                    // Execute OCR process
                    setTimeout(async () => {
                        try {
                            const ocrResult = await MlkitOcr.recognizeText(foto.uri);
                            if (ocrResult && (Array.isArray(ocrResult) ? ocrResult.length > 0 : !!ocrResult.blocks)) {
                                const parsed = parseOCRResult(ocrResult);
                                setNome(parsed.nome);
                                setValorUnitario(parsed.valorUnitario.toString());
                            } else {
                                throw new Error("Texto não detectado na imagem");
                            }
                        } catch (ocrError) {
                            console.warn("OCR falhou, aplicando fallback de simulação:", ocrError);
                            // Fallback simulation (for simulators and web)
                            const randomProduct = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
                            setNome(randomProduct.name);
                            setValorUnitario(randomProduct.price.toString());
                            
                            Alert.alert(
                                "Simulação de OCR",
                                `O processamento de OCR real falhou ou não é suportado neste ambiente (simulador).\n\nMock gerado:\nProduto: ${randomProduct.name}\nValor: R$ ${randomProduct.price.toFixed(2)}`
                            );
                        } finally {
                            setIsAnalyzing(false);
                            setShowForm(true);
                        }
                    }, 1500); // Visual duration for "Analisando..." state
                }
            } catch (error) {
                console.error("Erro ao tirar foto:", error);
                setIsAnalyzing(false);
                Alert.alert("Erro", "Não foi possível capturar a foto.");
            }
        }
    };

    const handleAbrirCamera = async () => {
        if (!permission || !permission.granted) {
            const resposta = await requestPermission();
            if (!resposta.granted) {
                Alert.alert("Permissão Negada", "Precisamos de acesso à câmera para fotografar o produto.");
                return;
            }
        }
        setIsCameraOpen(true);
    };

    const handleDeletarItem = async (id: number) => {
        Alert.alert(
            "Remover Item",
            "Deseja realmente excluir este item da lista?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                        await deleteItemFromList(id);
                        carregarDadosDaLista();
                    }
                }
            ]
        );
    };

    const handlePrepararEdicao = (item: ShoppingItem) => {
        if (!item.id) return;
        setEditingId(item.id);
        setNome(item.nome);
        setValorUnitario(item.valorUnitario.toString());
        setQuantidade(item.quantidade.toString());
        setImagemUrl(item.imageUrl);
        setShowForm(true);
    };

    const resetForm = () => {
        setNome('');
        setValorUnitario('');
        setQuantidade('1');
        setImagemUrl('');
        setEditingId(null);
        setIsCameraOpen(false);
        setShowForm(false);
        setIsAnalyzing(false);
    };

    const saveItemFunction = async () => {
        if (!imagemUrl.trim()) {
            Alert.alert("Atenção", "É obrigatório capturar uma foto do produto para poder salvá-lo!");
            return;
        }

        if (!nome.trim() || !valorUnitario.trim() || !quantidade.trim()) {
            Alert.alert("Atenção", "Preencha todos os campos!");
            return;
        }

        const valor = parseFloat(valorUnitario.replace(',', '.'));
        const qtd = parseInt(quantidade, 10);

        if (isNaN(valor) || isNaN(qtd) || valor <= 0 || qtd <= 0) {
            Alert.alert("Erro", "Informe valores numéricos válidos e maiores que zero!");
            return;
        }

        try {
            if (editingId !== null) {
                await updateItemInList(
                    editingId,
                    nome.trim(),
                    imagemUrl,
                    valor,
                    qtd,
                    valor * qtd
                );
                Alert.alert("Sucesso", "Produto atualizado com sucesso!");
            } else {
                await addItemToList(
                    listId,
                    nome.trim(),
                    imagemUrl,
                    valor,
                    qtd,
                    valor * qtd
                );
                Alert.alert("Sucesso", "Produto adicionado à lista!");
            }
            resetForm();
            carregarDadosDaLista();
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            Alert.alert("Erro", "Ocorreu um erro ao salvar o produto.");
        }
    };

    const valorTotalGeral = itens.reduce((acc, item) => acc + item.valorTotal, 0);

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Feather name="arrow-left" size={20} color="#74C69D" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{listName || "Detalhes da Lista"}</Text>
                    <Text style={styles.headerSubtitle}>
                        {itens.length} {itens.length === 1 ? "item" : "itens"}
                    </Text>
                </View>
                {syncing ? (
                    <ActivityIndicator size="small" color="#74C69D" style={{ width: 44, height: 44 }} />
                ) : (
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={handleSyncList}
                        activeOpacity={0.7}
                    >
                        <Feather name={cloudId ? "cloud" : "cloud-lightning"} size={20} color="#74C69D" />
                    </TouchableOpacity>
                )}
            </View>

            {/* List Body */}
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 80}
            >
                <FlatList
                    data={itens}
                    keyExtractor={(item) => item.id?.toString() || String(Math.random())}
                    contentContainerStyle={styles.listScroll}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"

                    renderItem={({ item }) => (
                        <View style={styles.itemRow}>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => setPreviewImageUri(item.imageUrl)}
                            >
                                <Image source={{ uri: item.imageUrl }} style={styles.itemThumbnail} />
                                <View style={styles.zoomIconIndicator}>
                                    <Feather name="maximize-2" size={10} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>

                            <View style={styles.itemInfo}>
                                <Text style={styles.itemName} numberOfLines={1}>{item.nome}</Text>
                                <Text style={styles.itemDetails}>
                                    {item.quantidade}x · R$ {item.valorUnitario.toFixed(2).replace('.', ',')}
                                </Text>
                            </View>
                            <View style={styles.itemActionContainer}>
                                <Text style={styles.itemTotal}>
                                    R$ {item.valorTotal.toFixed(2).replace('.', ',')}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.editBtn]}
                                    onPress={() => handlePrepararEdicao(item)}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="edit-2" size={14} color="#2D7A4F" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.deleteBtn]}
                                    onPress={() => handleDeletarItem(item.id!)}
                                    activeOpacity={0.7}
                                >
                                    <Feather name="trash-2" size={14} color="#FF6347" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconBg}>
                                <Feather name="plus-circle" size={36} color="#8FAF97" />
                            </View>
                            <Text style={styles.emptyText}>Nenhum item nesta lista.</Text>
                            <Text style={styles.emptySubtitle}>Aponte a câmera e tire foto de um produto para começar.</Text>
                        </View>
                    }

                    ListFooterComponent={
                        <View style={{ marginTop: 8, marginBottom: 32 }}>
                            {isAnalyzing && (
                                <View style={styles.analyzingCard}>
                                    <ActivityIndicator size="large" color="#2D7A4F" style={{ marginBottom: 12 }} />
                                    <Text style={styles.analyzingTitle}>Analisando produto...</Text>
                                    <Text style={styles.analyzingSubtitle}>
                                        A IA está identificando o nome e extraindo o valor do produto da gôndola.
                                    </Text>
                                </View>
                            )}

                            {isCameraOpen && (
                                <View style={styles.cameraContainer}>
                                    <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
                                    <View style={styles.cameraControls}>
                                        <TouchableOpacity style={styles.camBtn} onPress={toggleCameraFacing} activeOpacity={0.7}>
                                            <Feather name="rotate-cw" size={18} color="#FFFFFF" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.camBtn, styles.camCaptureBtn]} onPress={handleTirarFoto} activeOpacity={0.7}>
                                            <View style={styles.camCaptureBtnInner} />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.camBtn, { backgroundColor: '#FF6347' }]} onPress={() => setIsCameraOpen(false)} activeOpacity={0.7}>
                                            <Feather name="x" size={18} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {!isCameraOpen && !isAnalyzing && !showForm && (
                                <TouchableOpacity
                                    style={styles.openFormButton}
                                    onPress={handleAbrirCamera}
                                    activeOpacity={0.85}
                                >
                                    <Feather name="camera" size={20} color="#2D7A4F" style={{ marginRight: 8 }} />
                                    <Text style={styles.openFormButtonText}>Tirar Foto do Produto</Text>
                                </TouchableOpacity>
                            )}

                            {showForm && (
                                <View style={styles.formCard}>
                                    <View style={styles.formHeaderRow}>
                                        <Text style={styles.formCardTitle}>
                                            {editingId !== null ? "Editar Produto" : "Novo Produto"}
                                        </Text>
                                        <TouchableOpacity onPress={resetForm} activeOpacity={0.7}>
                                            <Text style={styles.cancelText}>Cancelar</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {imagemUrl ? (
                                        <View style={styles.formImagePreviewContainer}>
                                            <Image source={{ uri: imagemUrl }} style={styles.formImagePreview} />
                                            <TouchableOpacity 
                                                style={styles.retakeBtn} 
                                                onPress={handleAbrirCamera}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="refresh-cw" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                                                <Text style={styles.retakeBtnText}>Tirar Outra Foto</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}

                                    <View style={styles.formFields}>
                                        <View style={styles.inputGroup}>
                                            <Text style={styles.label}>Nome do Produto</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Ex: Leite Integral"
                                                placeholderTextColor="#8FAF97"
                                                value={nome}
                                                onChangeText={setNome}
                                            />
                                        </View>

                                        <View style={styles.formRow}>
                                            <View style={[styles.inputGroup, { flex: 1.2 }]}>
                                                <Text style={styles.label}>Valor Unitário (R$)</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="Ex: 4.99"
                                                    placeholderTextColor="#8FAF97"
                                                    value={valorUnitario}
                                                    keyboardType="numeric"
                                                    onChangeText={setValorUnitario}
                                                />
                                            </View>

                                            <View style={[styles.inputGroup, { flex: 0.8 }]}>
                                                <Text style={styles.label}>Quantidade</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="Ex: 1"
                                                    placeholderTextColor="#8FAF97"
                                                    value={quantidade}
                                                    keyboardType="numeric"
                                                    onChangeText={setQuantidade}
                                                />
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.saveBtn}
                                            onPress={saveItemFunction}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={styles.saveBtnText}>
                                                {editingId !== null ? "Salvar Alterações" : "Adicionar à Lista"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    }
                />
            </KeyboardAvoidingView>

            {/* Total Footer */}
            {itens.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.footerHeader}>
                        <Text style={styles.footerCount}>{itens.length} {itens.length === 1 ? "item" : "itens"} na lista</Text>
                        <Text style={styles.footerTotalLabel}>Total estimado</Text>
                    </View>
                    <Text style={styles.footerTotalVal}>
                        R$ {valorTotalGeral.toFixed(2).replace('.', ',')}
                    </Text>
                </View>
            )}

            {/* Verification Image Preview Modal */}
            <Modal
                visible={!!previewImageUri}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewImageUri(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Verificação de Preço</Text>
                            <TouchableOpacity
                                style={styles.modalCloseBtn}
                                onPress={() => setPreviewImageUri(null)}
                            >
                                <Feather name="x" size={20} color="#1A2E1F" />
                            </TouchableOpacity>
                        </View>
                        {previewImageUri && (
                            <Image
                                source={{ uri: previewImageUri }}
                                style={styles.modalFullscreenImage}
                                resizeMode="contain"
                            />
                        )}
                        <Text style={styles.modalCaption}>
                            Foto tirada na gôndola comprovando o valor do produto para conferência.
                        </Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5FBF7',
    },
    header: {
        backgroundColor: '#1B4332',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 44 : 16,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFFFFF',
        maxWidth: 200,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#74C69D',
        marginTop: 2,
    },
    listScroll: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 18,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#D8F3DC',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    itemThumbnail: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#E8F5EC',
        borderWidth: 1,
        borderColor: '#C8E3DF',
    },
    zoomIconIndicator: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 18,
        height: 18,
        borderRadius: 5,
        backgroundColor: 'rgba(27, 67, 50, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 14,
    },
    itemName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1A2E1F',
    },
    itemDetails: {
        fontSize: 12,
        color: '#5A7A65',
        marginTop: 2,
    },
    itemActionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemTotal: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#2D7A4F',
        marginRight: 6,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBtn: {
        backgroundColor: '#E8F5EC',
    },
    deleteBtn: {
        backgroundColor: '#FFF3F0',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyIconBg: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#E8F5EC',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#5A7A65',
    },
    emptySubtitle: {
        fontSize: 12,
        color: '#8FAF97',
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: 30,
        lineHeight: 16,
    },
    openFormButton: {
        height: 52,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderRadius: 16,
        borderColor: '#2D7A4F',
        borderStyle: 'dashed',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    openFormButtonText: {
        color: '#2D7A4F',
        fontSize: 15,
        fontWeight: 'bold',
    },
    analyzingCard: {
        backgroundColor: '#E8F5EC',
        borderWidth: 1.5,
        borderColor: '#74C69D',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    analyzingTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1B4332',
    },
    analyzingSubtitle: {
        fontSize: 12,
        color: '#5A7A65',
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16,
    },
    cameraContainer: {
        height: 300,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000',
        marginBottom: 16,
    },
    camera: {
        flex: 1,
    },
    cameraControls: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    camBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    camCaptureBtn: {
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        backgroundColor: 'transparent',
    },
    camCaptureBtnInner: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FFFFFF',
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#D8F3DC',
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    formHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    formCardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A2E1F',
    },
    cancelText: {
        color: '#FF6347',
        fontSize: 14,
        fontWeight: 'bold',
    },
    formImagePreviewContainer: {
        height: 180,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        position: 'relative',
    },
    formImagePreview: {
        width: '100%',
        height: '100%',
    },
    retakeBtn: {
        position: 'absolute',
        bottom: 12,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(27, 67, 50, 0.85)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    retakeBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold',
    },
    formFields: {
        gap: 12,
    },
    formRow: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        gap: 6,
    },
    label: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#2D7A4F',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        height: 46,
        borderWidth: 1,
        borderColor: '#C8E3DF',
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 14,
        color: '#1A2E1F',
        backgroundColor: '#F5FAFA',
    },
    saveBtn: {
        height: 48,
        backgroundColor: '#2D7A4F',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#2D7A4F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 2,
    },
    saveBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    footer: {
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#D8F3DC',
        paddingHorizontal: 24,
        paddingVertical: 18,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    footerHeader: {
        gap: 2,
    },
    footerCount: {
        fontSize: 11,
        color: '#8FAF97',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        fontWeight: 'bold',
    },
    footerTotalLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1A2E1F',
    },
    footerTotalVal: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2D7A4F',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(13, 31, 22, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        width: '100%',
        borderRadius: 28,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1A2E1F',
    },
    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F0F9F3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalFullscreenImage: {
        width: '100%',
        height: 350,
        borderRadius: 16,
        backgroundColor: '#E8F5EC',
    },
    modalCaption: {
        fontSize: 12,
        color: '#5A7A65',
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 16,
    },
});