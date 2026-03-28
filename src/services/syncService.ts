class SyncService {
  private queue: any[] = [];

  getQueue() {
    return this.queue;
  }

  clearQueue() {
    this.queue = [];
  }

  removeFromQueue(id: string) {
    this.queue = this.queue.filter(item => item.id !== id);
  }

  addToQueue(item: any) {
    this.queue.push(item);
  }
}

export const syncService = new SyncService();
