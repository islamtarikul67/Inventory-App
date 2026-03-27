import { InventoryItem, InventorySession } from "../types";

const SESSIONS_KEY = "inventory_sessions";
const ITEMS_KEY = "inventory_items";

export const storage = {
  getSessions: (): InventorySession[] => {
    const data = localStorage.getItem(SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveSessions: (sessions: InventorySession[]) => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  },
  getItems: (): InventoryItem[] => {
    const data = localStorage.getItem(ITEMS_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveItems: (items: InventoryItem[]) => {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
  },
  getItemsBySession: (sessionId: string): InventoryItem[] => {
    return storage.getItems().filter(item => item.sessionId === sessionId);
  },
  addItem: (item: InventoryItem) => {
    const items = storage.getItems();
    storage.saveItems([...items, item]);
  },
  updateItem: (updatedItem: InventoryItem) => {
    const items = storage.getItems();
    storage.saveItems(items.map(item => item.id === updatedItem.id ? updatedItem : item));
  },
  deleteItem: (id: string) => {
    const items = storage.getItems();
    storage.saveItems(items.filter(item => item.id !== id));
  },
  createSession: (name: string): InventorySession => {
    const sessions = storage.getSessions();
    const newSession: InventorySession = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    storage.saveSessions([...sessions, newSession]);
    return newSession;
  },
  deleteSession: (id: string) => {
    const sessions = storage.getSessions();
    storage.saveSessions(sessions.filter(s => s.id !== id));
    const items = storage.getItems();
    storage.saveItems(items.filter(item => item.sessionId !== id));
  }
};
