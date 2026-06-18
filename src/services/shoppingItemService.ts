import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { ShoppingItem } from '../types/ShoppingItem';
import { addItemToList } from '../services/sqlite';

export async function saveShoppingItemSqLite(item: ShoppingItem) {
    if (item.list_id) {
        await addItemToList(
            item.list_id,
            item.nome,
            item.imageUrl ?? "",
            item.valorUnitario,
            item.quantidade,
            item.valorTotal
        );
    }
}

export async function saveShoppingItemFirebase(item: ShoppingItem) {
    await addDoc(collection(db, 'shoppingItems'), item);
}