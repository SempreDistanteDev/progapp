import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { getListById, getItemsByList, updateListCloudId } from "./sqlite";

export async function syncListToCloud(listId: number): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("Usuário não autenticado. Faça login para sincronizar.");
    }

    // 1. Fetch list and items from SQLite
    const list = await getListById(listId);
    if (!list) {
        throw new Error("Lista não encontrada localmente.");
    }

    const items = await getItemsByList(listId);

    // 2. Map items with local image URLs (bypassing Firebase Storage)
    const syncedItems = items.map(item => ({
        nome: item.nome,
        imageUrl: item.imageUrl,
        valorUnitario: item.valorUnitario,
        quantidade: item.quantidade,
        valorTotal: item.valorTotal
    }));

    // 3. Prepare Firestore payload
    const totalGeral = syncedItems.reduce((acc, item) => acc + item.valorTotal, 0);
    const listPayload = {
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
        nome: list.nome,
        dataCreate: list.createdAt,
        valorTotalGeral: totalGeral,
        produtos: syncedItems
    };

    // 4. Save to Firestore (create or update)
    let cloudId = list.cloudId;
    if (cloudId) {
        // Update existing document
        await setDoc(doc(db, "historico_lista", cloudId), listPayload);
        console.log(`Lista atualizada na nuvem com ID: ${cloudId}`);
    } else {
        // Create new document
        const docRef = await addDoc(collection(db, "historico_lista"), listPayload);
        cloudId = docRef.id;
        // Save cloud ID locally in SQLite
        await updateListCloudId(listId, cloudId);
        console.log(`Nova lista criada na nuvem com ID: ${cloudId}`);
    }

    return cloudId;
}
