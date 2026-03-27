export interface PendingItem {
  id: string;
  codice: string;
  descrizione: string;
  lotto: string;
  quantita: number;
  sessione_id: string | null;
  note?: string | null;
  timestamp: number;
}

const QUEUE_KEY = 'inventory_offline_queue';

export const syncService = {
  getQueue(): PendingItem[] {
    try {
      const queue = localStorage.getItem(QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (e) {
      console.error('Error reading offline queue', e);
      return [];
    }
  },

  addToQueue(item: Omit<PendingItem, 'id' | 'timestamp'>) {
    const queue = this.getQueue();
    const newItem: PendingItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    queue.push(newItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return newItem;
  },

  removeFromQueue(id: string) {
    const queue = this.getQueue();
    const newQueue = queue.filter(item => item.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
  },

  clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
  }
};
