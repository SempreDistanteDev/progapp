import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Button } from 'react-native';
import { getAllItems, deleteItemFromList } from '../services/sqlite'; // Ajuste o caminho
import { ShoppingItem } from '../types/ShoppingItem';

export default function ListarItensScreen() {
    const [itens, setItens] = useState<ShoppingItem[]>([]);

    // Função que busca os dados do SQLite
    const carregarItens = async () => {
        try {
            const dados = await getAllItems();
            // O expo-sqlite retorna um array de objetos com as colunas da tabela
            setItens(dados as ShoppingItem[]);
        } catch (error) {
            console.error("Erro ao buscar itens do SQLite:", error);
        }
    };

    // Carrega os itens assim que a tela abre
    useEffect(() => {
        carregarItens();
    }, []);

    const handleDeletar = async (id: number) => {
        await deleteItemFromList(id);
        carregarItens(); // Atualiza a lista após deletar
    };

    return (
        <View style={styles.container}>
            <Text style={styles.titulo}>Itens no SQLite:</Text>
            
            <Button title="Atualizar Lista" onPress={carregarItens} />

            <FlatList
                data={itens}
                keyExtractor={(item) => item.id!.toString()}
                renderItem={({ item }) => (
                    <View style={styles.itemCard}>
                        <View>
                            <Text style={styles.itemNome}>{item.nome}</Text>
                            <Text>Qtd: {item.quantidade}x | Unitário: R$ {item.valorUnitario.toFixed(2)}</Text>
                            <Text style={styles.itemTotal}>Total: R$ {item.valorTotal.toFixed(2)}</Text>
                        </View>
                        <Button title="X" color="red" onPress={() => handleDeletar(item.id!)} />
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.vazio}>Nenhum item salvo no banco local.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#FFF' },
    titulo: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, marginTop: 40 },
    itemCard: { 
        padding: 15, 
        backgroundColor: '#f9f9f9', 
        borderRadius: 8, 
        marginVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#eee'
    },
    itemNome: { fontSize: 18, fontWeight: 'bold' },
    itemTotal: { fontWeight: '600', color: '#2E6B63' },
    vazio: { textAlign: 'center', marginTop: 40, color: '#666' }
});