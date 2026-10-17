const STORAGE_KEY = 'fight-arena.coins.v1';

/** Stores the persistent coin balance in browser storage. */
export class CoinWallet {
  private balance = 0;
  private readonly storage?: Storage;

  constructor() {
    try {
      this.storage = window.localStorage;
      const storedBalance = this.storage.getItem(STORAGE_KEY);
      const parsedBalance = storedBalance === null ? 0 : Number(storedBalance);
      if (Number.isSafeInteger(parsedBalance) && parsedBalance >= 0) this.balance = parsedBalance;
    } catch {
      // The in-memory balance still works if browser storage is unavailable.
    }
  }

  get coins(): number {
    return this.balance;
  }

  add(amount: number): number {
    const reward = Number.isSafeInteger(amount) ? Math.max(0, amount) : 0;
    this.balance += reward;

    try {
      this.storage?.setItem(STORAGE_KEY, String(this.balance));
    } catch {
      // Keep the current session's balance when storage is unavailable or full.
    }

    return this.balance;
  }
}
