import { InventoryItem } from '../types';

const QUEUE_KEY = 'inventory_sync_queue';

export const syncService = {
  getQueue(): InventoryItem[] {
    const saved = localStorage.getItem(QUEUE_KEY);
    return saved ? JSON.parse(saved) : [];
  },

  addToQueue(item: InventoryItem) {
    const queue = this.getQueue();
    queue.push(item);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  removeFromQueue(id: string) {
    const queue = this.getQueue();
    const filtered = queue.filter(item => item.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  },

  clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
  }
};
