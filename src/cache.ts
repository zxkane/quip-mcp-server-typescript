/**
 * Cache implementation for the Quip MCP Server
 */

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  /**
   * Cached value
   */
  value: T;
  
  /**
   * Expiration timestamp (milliseconds since epoch)
   */
  expiresAt: number;
}

/**
 * Simple in-memory cache with expiration
 */
export class Cache<T> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl: number;
  private maxEntries: number;
  
  /**
   * Create a new cache
   * 
   * @param defaultTtl Default time-to-live in milliseconds (default: 5 minutes)
   * @param maxEntries Maximum number of entries to store (default: 100)
   */
  constructor(defaultTtl: number = 5 * 60 * 1000, maxEntries: number = 100) {
    this.defaultTtl = defaultTtl;
    this.maxEntries = maxEntries;
  }
  
  /**
   * Get a value from the cache
   * 
   * @param key Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  /**
   * Set a value in the cache
   * 
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in milliseconds (default: use constructor value)
   */
  set(key: string, value: T, ttl?: number): void {
    // Enforce maximum entries limit
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      // Remove oldest entry (first in Map)
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }
    
    const expiresAt = Date.now() + (ttl ?? this.defaultTtl);
    this.entries.set(key, { value, expiresAt });
  }
  
  /**
   * Check if a key exists in the cache and is not expired
   * 
   * @param key Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.entries.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete a key from the cache
   * 
   * @param key Cache key
   * @returns True if the key was deleted, false if it didn't exist
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }
  
  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.entries.clear();
  }
  
  /**
   * Get the number of entries in the cache
   * 
   * @returns Number of entries
   */
  size(): number {
    return this.entries.size;
  }
  
  /**
   * Remove all expired entries from the cache
   * 
   * @returns Number of entries removed
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key);
        removed++;
      }
    }
    
    return removed;
  }
  
  /**
   * Get or set a value in the cache
   * 
   * If the key exists and is not expired, returns the cached value.
   * Otherwise, calls the factory function to generate a new value,
   * stores it in the cache, and returns it.
   * 
   * @param key Cache key
   * @param factory Function to generate the value if not in cache
   * @param ttl Time-to-live in milliseconds (default: use constructor value)
   * @returns The cached or newly generated value
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cachedValue = this.get(key);
    
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }
}

// Create a global cache instance for CSV data
export const csvCache = new Cache<string>(10 * 60 * 1000); // 10 minutes TTL

// Create a global cache instance for metadata
export const metadataCache = new Cache<Record<string, any>>(30 * 60 * 1000); // 30 minutes TTL