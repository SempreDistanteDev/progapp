import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { ShoppingItem } from '../types/ShoppingItem';

export async function saveFullList(userId: string, userEmail: string, itens: ShoppingItem[], valorTotal: number) {
    const newListDoc = {
        userId,
        userEmail,
        dataCreate: new Date().toISOString(),
        valorTotalGeral: valorTotal,
        produtos: itens
    };

    return await addDoc(collection(db, 'historico_lista'), newListDoc);
}