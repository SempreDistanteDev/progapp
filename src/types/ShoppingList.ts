import { ShoppingItem } from "./ShoppingItem";

export interface ShoppingList {
    id?: number;
    nome: string;
    createdAt: string;
    cloudId?: string | null;
    items?: ShoppingItem[];
}
