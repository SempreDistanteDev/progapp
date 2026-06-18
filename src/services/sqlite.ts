import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase() {
    if (!db) {
        db = await SQLite.openDatabaseAsync("shopping.db");
    }
    return db;
}

export async function initializeDatabase() {
    try {
        const database = await getDatabase();

        // Enable foreign key support
        await database.execAsync("PRAGMA foreign_keys = ON;");

        // Migration check: Drop the old shopping_items if it doesn't have the list_id column
        try {
            const tableInfo = await database.getAllAsync<{ name: string }>("PRAGMA table_info(shopping_items);");
            if (tableInfo.length > 0) {
                const hasListId = tableInfo.some(col => col.name === "list_id");
                if (!hasListId) {
                    console.log("Old shopping_items schema detected. Recreating database...");
                    await database.execAsync("DROP TABLE IF EXISTS shopping_items;");
                }
            }
        } catch (err) {
            console.error("Migration check error:", err);
        }

        // Create shopping_lists table
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS shopping_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                createdAt TEXT NOT NULL,
                cloudId TEXT
            );
        `);

        // Create shopping_items table
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS shopping_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                list_id INTEGER NOT NULL,
                nome TEXT NOT NULL,
                imageUrl TEXT NOT NULL,
                valorUnitario REAL NOT NULL,
                quantidade INTEGER NOT NULL,
                valorTotal REAL NOT NULL,
                FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
            );
        `);
        
        console.log("Banco de dados inicializado com sucesso!");
    } catch (error) {
        console.error("Erro detalhado ao inicializar o banco:", error);
        throw error;
    }
}

// --- List CRUD Operations ---

export async function createList(nome: string): Promise<number> {
    const database = await getDatabase();
    const createdAt = new Date().toLocaleDateString("pt-BR");
    const result = await database.runAsync(
        `INSERT INTO shopping_lists (nome, createdAt) VALUES (?, ?);`,
        [nome, createdAt]
    );
    return result.lastInsertRowId;
}

export async function getLists(): Promise<any[]> {
    const database = await getDatabase();
    return await database.getAllAsync(`
        SELECT 
            l.id, 
            l.nome, 
            l.createdAt, 
            l.cloudId, 
            COUNT(i.id) as itemCount, 
            COALESCE(SUM(i.valorTotal), 0) as totalVal
        FROM shopping_lists l
        LEFT JOIN shopping_items i ON l.id = i.list_id
        GROUP BY l.id
        ORDER BY l.id DESC;
    `);
}

export async function getListById(id: number): Promise<any> {
    const database = await getDatabase();
    return await database.getFirstAsync(`SELECT * FROM shopping_lists WHERE id = ?;`, [id]);
}

export async function updateListCloudId(id: number, cloudId: string | null) {
    const database = await getDatabase();
    await database.runAsync(`UPDATE shopping_lists SET cloudId = ? WHERE id = ?;`, [cloudId, id]);
}

export async function deleteList(id: number) {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM shopping_lists WHERE id = ?;`, [id]);
}

// --- Item CRUD Operations ---

export async function addItemToList(
    listId: number,
    nome: string,
    imageUrl: string,
    valorUnitario: number,
    quantidade: number,
    valorTotal: number
) {
    const database = await getDatabase();
    await database.runAsync(
        `INSERT INTO shopping_items (list_id, nome, imageUrl, valorUnitario, quantidade, valorTotal) VALUES (?, ?, ?, ?, ?, ?);`,
        [listId, nome, imageUrl, valorUnitario, quantidade, valorTotal]
    );
}

export async function getItemsByList(listId: number): Promise<any[]> {
    const database = await getDatabase();
    return await database.getAllAsync(`SELECT * FROM shopping_items WHERE list_id = ?;`, [listId]);
}

export async function updateItemInList(
    id: number,
    nome: string,
    imageUrl: string,
    valorUnitario: number,
    quantidade: number,
    valorTotal: number
) {
    const database = await getDatabase();
    await database.runAsync(
        `UPDATE shopping_items SET nome = ?, imageUrl = ?, valorUnitario = ?, quantidade = ?, valorTotal = ? WHERE id = ?;`,
        [nome, imageUrl, valorUnitario, quantidade, valorTotal, id]
    );
}

export async function deleteItemFromList(id: number) {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM shopping_items WHERE id = ?;`, [id]);
}

export async function getAllItems(): Promise<any[]> {
    const database = await getDatabase();
    return await database.getAllAsync(`SELECT * FROM shopping_items ORDER BY id DESC;`);
}

export async function clearAllData() {
    const database = await getDatabase();
    await database.runAsync(`DELETE FROM shopping_items;`);
    await database.runAsync(`DELETE FROM shopping_lists;`);
}